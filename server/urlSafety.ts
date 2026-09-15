/**
 * Whether a URL supplied by a daycare leader may be fetched by the server.
 *
 * The meal menu source is a free text field. It was handed straight to
 * Puppeteer's page.goto, so anyone who could edit a daycare's settings could
 * point the server's browser at any address the server could reach -- including
 * 127.0.0.1, the private network around it, and cloud metadata endpoints on
 * 169.254.169.254, which is where instance credentials live. The browser ran
 * without a sandbox and executed whatever it found.
 *
 * The check has two halves, deliberately separated so the classification can be
 * tested without a network: isPrivateAddress decides whether a resolved IP is
 * somewhere the server should never be sent, and assertPublicHttpUrl does the
 * parsing and the DNS lookup around it.
 *
 * DNS is resolved here rather than trusting the hostname, because "localhost" is
 * only the obvious case -- a name under someone else's control can point at
 * 127.0.0.1 just as easily.
 */

import dns from 'dns/promises';
import net from 'net';

/**
 * Addresses the server must never be told to fetch.
 *
 * Loopback, the three private IPv4 ranges, link-local (which carries the cloud
 * metadata endpoint), carrier-grade NAT, and the IPv6 equivalents.
 */
export function isPrivateAddress(ip: string): boolean {
  const version = net.isIP(ip);
  if (version === 0) return true; // not an address at all: refuse rather than guess

  if (version === 4) {
    const [a, b] = ip.split('.').map(Number);
    if (a === 0 || a === 127) return true;              // this host, loopback
    if (a === 10) return true;                           // private
    if (a === 172 && b >= 16 && b <= 31) return true;    // private
    if (a === 192 && b === 168) return true;             // private
    if (a === 169 && b === 254) return true;             // link-local, incl. metadata
    if (a === 100 && b >= 64 && b <= 127) return true;   // carrier-grade NAT
    if (a >= 224) return true;                           // multicast and reserved
    return false;
  }

  const lower = ip.toLowerCase();
  if (lower === '::' || lower === '::1') return true;                  // unspecified, loopback
  if (lower.startsWith('fe80')) return true;                            // link-local
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true;    // unique local
  if (lower.startsWith('ff')) return true;                              // multicast
  // ::ffff:127.0.0.1 and friends: judge the embedded IPv4 instead.
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip);
  if (mapped) return isPrivateAddress(mapped[1]);
  return false;
}

export class UnsafeUrlError extends Error {}

/**
 * Throws unless `raw` is an https URL whose host resolves only to public
 * addresses. Returns the parsed URL so callers navigate to what was checked
 * rather than re-parsing the string.
 */
export async function assertPublicHttpUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UnsafeUrlError('Menu source must be a valid URL');
  }

  // http:// would let a network-level attacker rewrite the page the server reads.
  if (url.protocol !== 'https:') {
    throw new UnsafeUrlError('Menu source must use https');
  }
  // Credentials in a URL are never needed here and are a way to reach something
  // that would otherwise refuse.
  if (url.username || url.password) {
    throw new UnsafeUrlError('Menu source must not contain credentials');
  }

  let resolved: Array<{ address: string }>;
  try {
    resolved = await dns.lookup(url.hostname, { all: true });
  } catch {
    throw new UnsafeUrlError('Menu source host could not be resolved');
  }

  // Every address, not just the first: a name can return one public and one
  // private address and get whichever the connection happens to pick.
  if (resolved.length === 0 || resolved.some((entry) => isPrivateAddress(entry.address))) {
    throw new UnsafeUrlError('Menu source must be a public address');
  }

  return url;
}
