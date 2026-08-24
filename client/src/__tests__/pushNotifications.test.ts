/**
 * Guards the two failures that made push notifications useless on a real device.
 *
 * Registration ran once at launch, which on a fresh install is before anyone has
 * signed in, so the device token had no session to attach itself to and was thrown
 * away; and signing out left the token registered, so the next person to use a
 * shared phone kept receiving the previous account's notifications.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

let native = true;
let permission: string = 'granted';

const push = {
  checkPermissions: vi.fn(async () => ({ receive: permission })),
  requestPermissions: vi.fn(async () => ({ receive: permission })),
  register: vi.fn(async () => {}),
  unregister: vi.fn(async () => {}),
  addListener: vi.fn(),
};

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => native,
    getPlatform: () => 'android',
  },
}));

vi.mock('@capacitor/push-notifications', () => ({
  PushNotifications: push,
}));

function fakeStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    clear: () => data.clear(),
  };
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  native = true;
  permission = 'granted';
  vi.clearAllMocks();
  (globalThis as any).localStorage = fakeStorage();
  fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({}) }));
  (globalThis as any).fetch = fetchMock;
  vi.stubEnv('VITE_API_URL', 'https://rutiini.example.fi');
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('registration', () => {
  it('attaches the registration listener before registering, so no token is missed', async () => {
    const mod = await import('../lib/pushNotifications');
    await mod.registerPushNotifications();

    expect(push.addListener).toHaveBeenCalled();
    const listenerOrder = push.addListener.mock.invocationCallOrder[0];
    const registerOrder = push.register.mock.invocationCallOrder[0];
    expect(listenerOrder).toBeLessThan(registerOrder);
  });

  it('does not register at launch when nobody is signed in', async () => {
    const mod = await import('../lib/pushNotifications');
    await mod.initializePushNotifications();
    expect(push.register).not.toHaveBeenCalled();
  });

  it('registers at launch for a device that is already signed in', async () => {
    localStorage.setItem('token', 'session-token');
    const mod = await import('../lib/pushNotifications');
    await mod.initializePushNotifications();
    expect(push.register).toHaveBeenCalled();
  });

  it('does nothing at all in the browser', async () => {
    native = false;
    localStorage.setItem('token', 'session-token');
    const mod = await import('../lib/pushNotifications');
    await mod.registerPushNotifications();
    await mod.initializePushNotifications();
    await mod.unregisterPushNotifications('session-token');
    expect(push.register).not.toHaveBeenCalled();
    expect(push.unregister).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('accepts a refusal without registering', async () => {
    permission = 'denied';
    const mod = await import('../lib/pushNotifications');
    await mod.registerPushNotifications();
    expect(push.register).not.toHaveBeenCalled();
  });

  it('sends the device token to the server once it arrives', async () => {
    localStorage.setItem('token', 'session-token');
    const mod = await import('../lib/pushNotifications');
    await mod.registerPushNotifications();

    const registration = push.addListener.mock.calls.find((c) => c[0] === 'registration');
    expect(registration).toBeDefined();
    await registration![1]({ value: 'device-token' });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://rutiini.example.fi/api/push-token',
      expect.objectContaining({ method: 'POST' }),
    );
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).toEqual({ token: 'device-token', platform: 'android' });
  });
});

describe('signing out', () => {
  it('removes the device token from the server so the next user is not notified', async () => {
    localStorage.setItem('token', 'session-token');
    const mod = await import('../lib/pushNotifications');
    await mod.registerPushNotifications();
    const registration = push.addListener.mock.calls.find((c) => c[0] === 'registration');
    await registration![1]({ value: 'device-token' });
    fetchMock.mockClear();

    await mod.unregisterPushNotifications('session-token');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://rutiini.example.fi/api/push-token',
      expect.objectContaining({ method: 'DELETE' }),
    );
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ token: 'device-token' });
    expect(push.unregister).toHaveBeenCalled();
    expect(localStorage.getItem('pushToken')).toBeNull();
  });

  it('still unregisters the device when the server call fails', async () => {
    localStorage.setItem('token', 'session-token');
    localStorage.setItem('pushToken', 'device-token');
    fetchMock.mockRejectedValue(new Error('offline'));
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const mod = await import('../lib/pushNotifications');
    await mod.unregisterPushNotifications('session-token');

    expect(push.unregister).toHaveBeenCalled();
    expect(localStorage.getItem('pushToken')).toBeNull();
  });
});
