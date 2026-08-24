/**
 * Which origins may call the API.
 *
 * This existed as `origin: process.env.CORS_ORIGIN || '*'` alongside
 * `credentials: true`, which does not work: a browser discards a response to a
 * credentialed request when Access-Control-Allow-Origin is the wildcard. Same-origin
 * requests never reach that check, so the web app was unaffected and the fault stayed
 * invisible -- but the iOS and Android builds are cross-origin by construction (the
 * webview serves the bundle from its own localhost origin and calls the deployment
 * over the network), so every request they made would have been blocked.
 *
 * The origin is therefore echoed rather than wildcarded, which is what makes
 * credentialed requests legal.
 */

/**
 * The origins a Capacitor webview presents. Android serves the bundle over
 * https://localhost, iOS over capacitor://localhost. These are the app itself, not
 * a website, so they are always allowed: refusing them would only mean refusing the
 * product's own mobile clients.
 */
export const NATIVE_ORIGINS = [
  'capacitor://localhost',
  'ionic://localhost',
  'https://localhost',
  'http://localhost',
];

export function parseAllowedOrigins(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/+$/, ''))
    .filter(Boolean);
}

export type OriginDecision = (
  origin: string | undefined,
  callback: (err: Error | null, allow?: boolean) => void,
) => void;

/**
 * Build the origin check.
 *
 * With CORS_ORIGIN set, only those origins and the native ones are allowed. Left
 * unset the request's own origin is echoed, which keeps the permissive behaviour the
 * deployment had before while making it actually usable with credentials.
 */
export function corsOrigin(configured: string | undefined): OriginDecision {
  const allowed = parseAllowedOrigins(configured);

  return (origin, callback) => {
    // No Origin header at all: a same-origin navigation, a health check, curl. These
    // are not subject to CORS in the first place.
    if (!origin) return callback(null, true);

    if (allowed.length === 0) return callback(null, true);

    const normalised = origin.replace(/\/+$/, '');
    if (allowed.includes(normalised) || NATIVE_ORIGINS.includes(normalised)) {
      return callback(null, true);
    }

    // Refuse by withholding the header rather than by failing the request: the
    // browser then blocks it, and a non-browser caller is unaffected.
    return callback(null, false);
  };
}
