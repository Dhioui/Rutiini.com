import { CapacitorUpdater } from '@capgo/capacitor-updater';
import { Capacitor } from '@capacitor/core';

export async function initializeLiveUpdater() {
  if (!Capacitor.isNativePlatform()) {
    return;
  }

  try {
    await CapacitorUpdater.notifyAppReady();
    console.log('[LiveUpdater] App ready notification sent');
  } catch (error) {
    console.error('[LiveUpdater] Failed to initialize:', error);
  }
}

export async function checkForUpdates() {
  if (!Capacitor.isNativePlatform()) {
    return null;
  }

  try {
    const latest = await CapacitorUpdater.getLatest();
    console.log('[LiveUpdater] Latest version:', latest);
    return latest;
  } catch (error) {
    console.error('[LiveUpdater] Failed to check updates:', error);
    return null;
  }
}
