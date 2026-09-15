/**
 * Which addresses the server may be sent to.
 *
 * The meal menu source is typed in by a daycare leader and fetched by a browser
 * running on the server, so the question this answers is "can one customer make
 * our server read something on our own network". The answers that matter are the
 * ones that must be refused, so those are what this asserts.
 */

import { describe, it, expect } from 'vitest';
import { isPrivateAddress, assertPublicHttpUrl, UnsafeUrlError } from '../urlSafety';

describe('addresses the server must refuse', () => {
  it('refuses loopback', () => {
    for (const ip of ['127.0.0.1', '127.1.2.3', '0.0.0.0', '::1', '::']) {
      expect(isPrivateAddress(ip), ip).toBe(true);
    }
  });

  it('refuses the three private IPv4 ranges', () => {
    for (const ip of ['10.0.0.1', '172.16.0.1', '172.31.255.254', '192.168.1.1']) {
      expect(isPrivateAddress(ip), ip).toBe(true);
    }
  });

  it('refuses the cloud metadata endpoint', () => {
    // 169.254.169.254 serves instance credentials on most cloud providers.
    expect(isPrivateAddress('169.254.169.254')).toBe(true);
  });

  it('refuses carrier-grade NAT, multicast and IPv6 local ranges', () => {
    for (const ip of ['100.64.0.1', '224.0.0.1', 'fe80::1', 'fd00::1', 'ff02::1']) {
      expect(isPrivateAddress(ip), ip).toBe(true);
    }
  });

  it('refuses an IPv4 address smuggled inside IPv6', () => {
    expect(isPrivateAddress('::ffff:127.0.0.1')).toBe(true);
    expect(isPrivateAddress('::ffff:10.0.0.1')).toBe(true);
  });

  it('refuses anything that is not an address at all', () => {
    // Refusing rather than guessing: an unparseable value is not evidence of safety.
    expect(isPrivateAddress('not-an-ip')).toBe(true);
    expect(isPrivateAddress('')).toBe(true);
  });

  it('allows ordinary public addresses', () => {
    for (const ip of ['1.1.1.1', '8.8.8.8', '93.184.216.34', '2606:4700::1111']) {
      expect(isPrivateAddress(ip), ip).toBe(false);
    }
  });

  it('treats 172.15 and 172.32 as public, since only 16-31 is private', () => {
    expect(isPrivateAddress('172.15.0.1')).toBe(false);
    expect(isPrivateAddress('172.32.0.1')).toBe(false);
  });
});

describe('the URL check around it', () => {
  it('refuses plain http, so the page cannot be rewritten in transit', async () => {
    await expect(assertPublicHttpUrl('http://example.com/menu')).rejects.toBeInstanceOf(UnsafeUrlError);
  });

  it('refuses credentials in the URL', async () => {
    await expect(assertPublicHttpUrl('https://user:pass@example.com/')).rejects.toBeInstanceOf(UnsafeUrlError);
  });

  it('refuses something that is not a URL', async () => {
    await expect(assertPublicHttpUrl('not a url')).rejects.toBeInstanceOf(UnsafeUrlError);
  });

  it('refuses localhost by name, not only by address', async () => {
    // The hostname is resolved rather than trusted: "localhost" is the obvious
    // case, but any name under someone else's control can point at 127.0.0.1.
    await expect(assertPublicHttpUrl('https://localhost/menu')).rejects.toBeInstanceOf(UnsafeUrlError);
  });

  it('refuses a literal private address', async () => {
    await expect(assertPublicHttpUrl('https://169.254.169.254/latest/meta-data/')).rejects
      .toBeInstanceOf(UnsafeUrlError);
  });
});
