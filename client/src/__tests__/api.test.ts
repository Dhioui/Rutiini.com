/**
 * Guards the base URL the native builds depend on.
 *
 * Every request the client makes goes through apiUrl(). In the browser it has to
 * stay a relative path -- the web app is served by the API process itself, and
 * rewriting those to an absolute address would turn every same-origin request
 * into a cross-origin one. In a native build the opposite is true: Capacitor
 * serves the bundle from its own localhost origin, so a relative path reaches
 * nothing and the app cannot sign in at all.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

let native = false;

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => native,
    getPlatform: () => (native ? 'ios' : 'web'),
  },
}));

async function loadApi(opts: { native: boolean; url?: string }) {
  native = opts.native;
  vi.stubEnv('VITE_API_URL', opts.url ?? '');
  vi.resetModules();
  return await import('../lib/api');
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('apiUrl on the web', () => {
  it('leaves paths relative so requests stay same-origin', async () => {
    const { apiUrl, API_BASE } = await loadApi({ native: false });
    expect(API_BASE).toBe('');
    expect(apiUrl('/api/children')).toBe('/api/children');
    expect(apiUrl('/api/public/daycares?municipality=Helsinki')).toBe(
      '/api/public/daycares?municipality=Helsinki',
    );
  });

  it('ignores VITE_API_URL, which is only meaningful for a native build', async () => {
    const { apiUrl } = await loadApi({ native: false, url: 'https://example.fi' });
    expect(apiUrl('/api/children')).toBe('/api/children');
  });
});

describe('apiUrl in a native build', () => {
  it('sends requests to the configured server', async () => {
    const { apiUrl } = await loadApi({ native: true, url: 'https://rutiini.example.fi' });
    expect(apiUrl('/api/children')).toBe('https://rutiini.example.fi/api/children');
  });

  it('tolerates a trailing slash rather than producing a double one', async () => {
    const { apiUrl } = await loadApi({ native: true, url: 'https://rutiini.example.fi/' });
    expect(apiUrl('/api/children')).toBe('https://rutiini.example.fi/api/children');
  });

  it('leaves an already absolute URL alone', async () => {
    const { apiUrl } = await loadApi({ native: true, url: 'https://rutiini.example.fi' });
    expect(apiUrl('https://other.example/api/x')).toBe('https://other.example/api/x');
  });

  it('reports a build made without the variable instead of failing silently', async () => {
    const { apiUrl } = await loadApi({ native: true });
    expect(console.error).toHaveBeenCalled();
    expect(apiUrl('/api/children')).toBe('/api/children');
  });
});
