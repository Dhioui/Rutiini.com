/**
 * Tests for the push transport's configuration handling.
 *
 * The delivery path itself needs Google's endpoints, so what is checked here is
 * the part that decides whether anything is attempted at all: an unconfigured or
 * malformed service account must disable sending quietly rather than throw inside
 * whatever action produced the notification.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { isPushConfigured, sendPushToUsers } from '../push';

const VALID = {
  project_id: 'rutiini-test',
  client_email: 'push@rutiini-test.iam.gserviceaccount.com',
  private_key: '-----BEGIN PRIVATE KEY-----\nnot-a-real-key\n-----END PRIVATE KEY-----\n',
};

describe('push configuration', () => {
  beforeEach(() => { delete process.env.FCM_SERVICE_ACCOUNT; });
  afterEach(() => { delete process.env.FCM_SERVICE_ACCOUNT; });

  it('is disabled when no service account is set', () => {
    expect(isPushConfigured()).toBe(false);
  });

  it('accepts a service account as JSON', () => {
    process.env.FCM_SERVICE_ACCOUNT = JSON.stringify(VALID);
    expect(isPushConfigured()).toBe(true);
  });

  it('accepts a service account as base64, for hosts that cannot carry newlines', () => {
    process.env.FCM_SERVICE_ACCOUNT = Buffer.from(JSON.stringify(VALID)).toString('base64');
    expect(isPushConfigured()).toBe(true);
  });

  it('rejects a service account missing required fields', () => {
    process.env.FCM_SERVICE_ACCOUNT = JSON.stringify({ project_id: 'x' });
    expect(isPushConfigured()).toBe(false);
  });

  it('rejects text that is not a service account', () => {
    process.env.FCM_SERVICE_ACCOUNT = 'not json at all';
    expect(isPushConfigured()).toBe(false);
  });

  it('sends nothing, and does not throw, when unconfigured', async () => {
    await expect(sendPushToUsers([1, 2, 3], { title: 'x', body: 'y' })).resolves.toBe(0);
  });

  it('sends nothing for an empty recipient list', async () => {
    process.env.FCM_SERVICE_ACCOUNT = JSON.stringify(VALID);
    await expect(sendPushToUsers([], { title: 'x', body: 'y' })).resolves.toBe(0);
  });
});
