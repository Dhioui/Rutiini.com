import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';
import { apiUrl } from '@/lib/api';

/**
 * The device token last issued to this installation.
 *
 * Kept so signing out can tell the server to stop sending to this device. It is a
 * routing address for the push services, not personal data, and it is removed as
 * soon as the session ends.
 */
const STORED_TOKEN_KEY = 'pushToken';

let listenersAttached = false;

function readStoredToken(): string | null {
  try {
    return localStorage.getItem(STORED_TOKEN_KEY);
  } catch {
    return null;
  }
}

function rememberToken(token: string | null) {
  try {
    if (token) localStorage.setItem(STORED_TOKEN_KEY, token);
    else localStorage.removeItem(STORED_TOKEN_KEY);
  } catch {
    // Storage can be unavailable; the token is still registered with the server,
    // it just cannot be cleaned up locally on sign-out.
  }
}

/**
 * Attach the listeners.
 *
 * These have to exist before register() is called: registration resolves through
 * these callbacks, so a token issued before the listener is attached is delivered to
 * nothing and lost until the next launch.
 */
function attachListeners() {
  if (listenersAttached) return;
  listenersAttached = true;

  PushNotifications.addListener('registration', async (token) => {
    rememberToken(token.value);
    await savePushToken(token.value);
  });

  PushNotifications.addListener('registrationError', (err) => {
    console.error('Push registration error:', err.error);
  });

  PushNotifications.addListener('pushNotificationReceived', (notification) => {
    // Delivered while the app is open. The in-app notification list is the record,
    // and it is refetched when the user opens it, so nothing is done here.
    console.log('Push notification received:', notification.title);
  });

  PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
    console.log('Push notification opened:', notification.notification.title);
  });
}

/**
 * Register this device for push, if the person has agreed to it.
 *
 * Called after signing in rather than only at launch. Registration used to run once
 * at boot, which on a fresh install is before anyone has signed in: the token
 * arrived, found no session to attach itself to, and was dropped. Nothing registered
 * again afterwards, so a newly installed app received no notifications at all until
 * it was launched a second time while already signed in.
 */
export async function registerPushNotifications() {
  if (!Capacitor.isNativePlatform()) return;

  try {
    let permStatus = await PushNotifications.checkPermissions();

    if (permStatus.receive === 'prompt' || permStatus.receive === 'prompt-with-rationale') {
      permStatus = await PushNotifications.requestPermissions();
    }

    if (permStatus.receive !== 'granted') {
      // A refusal is a legitimate choice; the app works without notifications.
      return;
    }

    attachListeners();
    await PushNotifications.register();
  } catch (error) {
    console.error('Error initializing push notifications:', error);
  }
}

/**
 * Called once at launch, for a device that is already signed in.
 */
export async function initializePushNotifications() {
  if (!Capacitor.isNativePlatform()) return;

  const signedIn = (() => {
    try {
      return Boolean(localStorage.getItem('token'));
    } catch {
      return false;
    }
  })();

  if (!signedIn) return;
  await registerPushNotifications();
}

async function savePushToken(token: string) {
  try {
    const authToken = localStorage.getItem('token');
    if (!authToken) return;

    await fetch(apiUrl('/api/push-token'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify({ token, platform: Capacitor.getPlatform() }),
    });
  } catch (error) {
    console.error('Error saving push token:', error);
  }
}

/**
 * Stop notifications for this device on sign-out.
 *
 * Without this the token stayed registered to the account that signed out, so the
 * next person to use the device -- a shared staff phone, a family tablet -- kept
 * receiving notifications naming another family's child. Must run while the session
 * is still valid, because removing the token is an authenticated request.
 */
export async function unregisterPushNotifications(authToken: string | null) {
  if (!Capacitor.isNativePlatform()) return;

  const token = readStoredToken();

  try {
    if (token && authToken) {
      await fetch(apiUrl('/api/push-token'), {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({ token }),
      });
    }
  } catch (error) {
    console.error('Error removing push token:', error);
  } finally {
    rememberToken(null);
    try {
      await PushNotifications.unregister();
    } catch (error) {
      console.error('Error unregistering push notifications:', error);
    }
  }
}
