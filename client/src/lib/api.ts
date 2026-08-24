import { Capacitor } from '@capacitor/core';

/**
 * Where the API lives.
 *
 * In the browser the client is served by the same Express process that serves the
 * API, so a relative "/api/..." is correct and this stays empty.
 *
 * In a native build there is no such server. Capacitor serves the bundled assets
 * from its own origin -- https://localhost on Android, capacitor://localhost on
 * iOS -- so a relative "/api/children" resolves to that origin and reaches
 * nothing at all: the app could not even sign in. Native builds therefore have to
 * be told the deployment's public address at build time:
 *
 *   VITE_API_URL=https://rutiini.example.fi npm run build && npx cap sync
 *
 * Left unset for a native build the app has no server to talk to, so the mistake
 * is reported at boot rather than surfacing as every request failing.
 */
function resolveBase(): string {
  const configured = (import.meta.env.VITE_API_URL ?? '').trim();

  if (!Capacitor.isNativePlatform()) {
    // The browser build ignores the variable: same-origin is always right there,
    // and pointing it elsewhere would only add a needless cross-origin hop.
    return '';
  }

  if (!configured) {
    console.error(
      '[api] VITE_API_URL was not set when this native build was made, so the app ' +
        'has no server to talk to. Rebuild with VITE_API_URL=https://your-server.',
    );
    return '';
  }

  return configured.replace(/\/+$/, '');
}

export const API_BASE = resolveBase();

/**
 * Absolute URL for an API path.
 *
 * Paths are passed through unchanged in the browser, so the web build sends
 * exactly the requests it sent before.
 */
export function apiUrl(path: string): string {
  if (!API_BASE) return path;
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`;
}
