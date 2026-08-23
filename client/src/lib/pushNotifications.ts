import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';

export async function initializePushNotifications() {
  if (!Capacitor.isNativePlatform()) {
    return;
  }

  try {
    let permStatus = await PushNotifications.checkPermissions();

    if (permStatus.receive === 'prompt') {
      permStatus = await PushNotifications.requestPermissions();
    }

    if (permStatus.receive !== 'granted') {
      console.log('Push notification permission not granted');
      return;
    }

    await PushNotifications.register();

    PushNotifications.addListener('registration', async (token) => {
      console.log('Push registration success, token: ' + token.value);
      await savePushToken(token.value);
    });

    PushNotifications.addListener('registrationError', (err) => {
      console.error('Push registration error: ', err.error);
    });

    PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('Push notification received: ', notification);
    });

    PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
      console.log('Push notification action performed: ', notification);
    });

  } catch (error) {
    console.error('Error initializing push notifications:', error);
  }
}

async function savePushToken(token: string) {
  try {
    const authToken = localStorage.getItem('token');
    if (!authToken) {
      console.log('No auth token, cannot save push token');
      return;
    }

    await fetch('/api/push-token', {
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

export async function unregisterPushNotifications() {
  if (!Capacitor.isNativePlatform()) {
    return;
  }

  try {
    await PushNotifications.unregister();
  } catch (error) {
    console.error('Error unregistering push notifications:', error);
  }
}
