/**
 * Tests for how rate-limit buckets are keyed.
 *
 * A daycare shares one public IP, so keying authenticated traffic by IP gave the
 * whole staff a single budget. These tests pin the behaviour that replaced it:
 * a valid token buys a per-user bucket, and anything else falls back to the IP.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { Request } from 'express';
import { generateToken } from '../auth';
import { userOrIpKey, envInt } from '../rateLimit';

const makeReq = (headers: Record<string, string> = {}, ip = '203.0.113.7') =>
  ({ headers, ip }) as unknown as Request;

describe('userOrIpKey', () => {
  it('gives two signed-in users separate buckets from the same IP', () => {
    const a = makeReq({ authorization: `Bearer ${generateToken(11)}` });
    const b = makeReq({ authorization: `Bearer ${generateToken(22)}` });

    expect(userOrIpKey(a)).toBe('user:11');
    expect(userOrIpKey(b)).toBe('user:22');
    expect(userOrIpKey(a)).not.toBe(userOrIpKey(b));
  });

  it('gives one user the same bucket across different IPs', () => {
    const token = generateToken(11);
    const office = makeReq({ authorization: `Bearer ${token}` }, '203.0.113.7');
    const home = makeReq({ authorization: `Bearer ${token}` }, '198.51.100.4');

    expect(userOrIpKey(office)).toBe(userOrIpKey(home));
  });

  it('falls back to the IP when there is no token', () => {
    expect(userOrIpKey(makeReq())).toBe('ip:203.0.113.7');
  });

  it('falls back to the IP for a forged or malformed token', () => {
    for (const header of ['Bearer not-a-jwt', 'Bearer ', 'garbage', '']) {
      expect(userOrIpKey(makeReq({ authorization: header })), header).toBe('ip:203.0.113.7');
    }
  });

  it('does not let an expired token buy a bucket of its own', () => {
    const expired = generateToken(11, -60);
    expect(userOrIpKey(makeReq({ authorization: `Bearer ${expired}` }))).toBe('ip:203.0.113.7');
  });

  it('handles a missing ip without throwing', () => {
    const req = { headers: {} } as unknown as Request;
    expect(() => userOrIpKey(req)).not.toThrow();
  });
});

describe('envInt', () => {
  const KEY = 'RATE_LIMIT_TEST_VALUE';
  beforeEach(() => { delete process.env[KEY]; });
  afterEach(() => { delete process.env[KEY]; });

  it('uses the fallback when unset', () => {
    expect(envInt(KEY, 600)).toBe(600);
  });

  it('reads a configured value', () => {
    process.env[KEY] = '1200';
    expect(envInt(KEY, 600)).toBe(1200);
  });

  it('ignores values that are not positive integers', () => {
    for (const bad of ['0', '-5', 'abc', '']) {
      process.env[KEY] = bad;
      expect(envInt(KEY, 600), bad).toBe(600);
    }
  });
});
