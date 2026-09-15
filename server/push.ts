import crypto from 'crypto';
import { log } from './static';

/**
 * Push notifications to phones, via Firebase Cloud Messaging.
 *
 * Device tokens were being collected and stored, but nothing ever sent anything to
 * them: notifications existed only inside the app. Guardians who had installed the
 * app and granted permission still had to open it to learn their child was sick or
 * a trip had been announced.
 *
 * This speaks FCM's HTTP v1 API directly rather than pulling in firebase-admin,
 * which is a large dependency for one request. Node supplies everything needed:
 * crypto signs the service-account assertion, fetch does the rest.
 *
 * Unconfigured, sending is skipped and logged. Push is a convenience -- the
 * in-app notification is written either way -- so a deployment without Firebase
 * still works, unlike email, which the server refuses to start without.
 */

/**
 * Google's endpoints, overridable so the delivery path can be exercised against a
 * stand-in. Never set these in production.
 */
const GOOGLE_OAUTH_BASE = process.env.GOOGLE_OAUTH_BASE_URL || 'https://oauth2.googleapis.com';
const FCM_BASE = process.env.FCM_BASE_URL || 'https://fcm.googleapis.com';

interface ServiceAccount {
  project_id: string;
  client_email: string;
  private_key: string;
}

export interface PushMessage {
  title: string;
  body: string;
  /** Delivered alongside the notification so the app can open the right screen. */
  data?: Record<string, string>;
}

function readServiceAccount(): ServiceAccount | null {
  const raw = process.env.FCM_SERVICE_ACCOUNT?.trim();
  if (!raw) return null;
  try {
    // Accept the JSON itself or a base64 copy of it: some hosts will not carry a
    // multi-line value in an environment variable.
    const json = raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8');
    const parsed = JSON.parse(json) as ServiceAccount;
    if (!parsed.project_id || !parsed.client_email || !parsed.private_key) {
      log('[Push] FCM_SERVICE_ACCOUNT is missing project_id, client_email or private_key', 'push');
      return null;
    }
    // Escaped newlines survive a single-line environment variable.
    parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
    return parsed;
  } catch {
    log('[Push] FCM_SERVICE_ACCOUNT is not valid JSON', 'push');
    return null;
  }
}

export function isPushConfigured(): boolean {
  return readServiceAccount() !== null;
}

const base64url = (input: Buffer | string) =>
  Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

let cachedToken: { value: string; expiresAt: number } | null = null;

/**
 * An OAuth access token for the service account.
 *
 * Cached until shortly before it expires; Google issues them for an hour, and
 * re-signing on every notification would be pure overhead.
 */
async function getAccessToken(account: ServiceAccount): Promise<string | null> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) return cachedToken.value;

  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = base64url(JSON.stringify({
    iss: account.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }));

  const signature = base64url(
    crypto.createSign('RSA-SHA256').update(`${header}.${claims}`).sign(account.private_key)
  );

  try {
    const response = await fetch(`${GOOGLE_OAUTH_BASE}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: `${header}.${claims}.${signature}`,
      }),
    });

    if (!response.ok) {
      log(`[Push] Could not obtain an access token: HTTP ${response.status}`, 'push');
      return null;
    }

    const body = (await response.json()) as { access_token: string; expires_in: number };
    cachedToken = {
      value: body.access_token,
      expiresAt: Date.now() + (body.expires_in - 60) * 1000,
    };
    return cachedToken.value;
  } catch (error: any) {
    log(`[Push] Token request failed: ${error?.message ?? error}`, 'push');
    return null;
  }
}

/**
 * Send a notification to every device belonging to the given users.
 *
 * Returns how many devices accepted it. Never throws: a notification that cannot
 * be delivered must not fail the action that produced it -- a guardian's absence
 * report is recorded whether or not the staff's phones can be reached.
 */
export async function sendPushToUsers(userIds: number[], message: PushMessage): Promise<number> {
  if (userIds.length === 0) return 0;

  const account = readServiceAccount();
  if (!account) return 0;

  // Imported here rather than at the top so this module can be loaded -- and its
  // configuration handling tested -- without opening a database connection.
  let storage;
  let tokens;
  try {
    ({ storage } = await import('./storage'));
    tokens = await storage.getPushTokensByUsers(userIds);
  } catch (error: any) {
    log(`[Push] Could not read device tokens: ${error?.message ?? error}`, 'push');
    return 0;
  }
  if (tokens.length === 0) return 0;

  const accessToken = await getAccessToken(account);
  if (!accessToken) return 0;

  const endpoint = `${FCM_BASE}/v1/projects/${account.project_id}/messages:send`;
  let delivered = 0;

  // One request per device: the v1 API has no multicast. Sent together rather than
  // in sequence so announcing a trip to a daycare does not take a round trip per
  // phone.
  //
  // iOS tokens are excluded. Capacitor's push plugin hands back whatever the
  // platform issued: on Android that is an FCM token, on iOS it is an APNs token,
  // and FCM cannot deliver to an APNs token -- it is not an FCM address. Every
  // iOS device was therefore being sent to and silently failing, which looked
  // from here like a working feature. Making iOS work needs Firebase Messaging in
  // the iOS project so it issues an FCM token, or a separate APNs sender; until
  // one of those exists, this says so once per batch rather than pretending.
  const deliverable = tokens.filter((device) => device.platform !== 'ios');
  const skipped = tokens.length - deliverable.length;
  if (skipped > 0) {
    log(`[Push] Skipped ${skipped} iOS device(s): APNs tokens cannot be delivered through FCM`, 'push');
  }

  const results = await Promise.allSettled(deliverable.map(async (device) => {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          token: device.token,
          notification: { title: message.title, body: message.body },
          ...(message.data ? { data: message.data } : {}),
        },
      }),
    });

    if (response.ok) return 'delivered' as const;

    // 404 UNREGISTERED means the app was uninstalled or the token was replaced;
    // 400 usually means it is malformed. Either way it will never work again, so
    // drop it rather than retrying it forever.
    if (response.status === 404 || response.status === 400) {
      await storage.deletePushToken(device.userId, device.token).catch(() => {});
      return 'stale' as const;
    }

    log(`[Push] FCM rejected a message: HTTP ${response.status}`, 'push');
    return 'failed' as const;
  }));

  for (const result of results) {
    if (result.status === 'fulfilled' && result.value === 'delivered') delivered++;
  }
  return delivered;
}
