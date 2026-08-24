import { describe, it, expect } from 'vitest';
import { corsOrigin, parseAllowedOrigins, NATIVE_ORIGINS } from '../cors';

function decide(configured: string | undefined, origin: string | undefined): boolean {
  let allowed: boolean | undefined;
  corsOrigin(configured)(origin, (err, ok) => {
    expect(err).toBeNull();
    allowed = ok;
  });
  return allowed === true;
}

describe('parseAllowedOrigins', () => {
  it('splits a list and drops blanks and trailing slashes', () => {
    expect(parseAllowedOrigins(' https://a.fi/, ,https://b.fi ')).toEqual([
      'https://a.fi',
      'https://b.fi',
    ]);
  });

  it('treats unset as no allowlist', () => {
    expect(parseAllowedOrigins(undefined)).toEqual([]);
  });
});

describe('corsOrigin', () => {
  it('allows a request with no Origin header, which CORS does not govern', () => {
    expect(decide('https://rutiini.fi', undefined)).toBe(true);
  });

  it('allows the configured origin', () => {
    expect(decide('https://rutiini.fi', 'https://rutiini.fi')).toBe(true);
  });

  it('refuses an origin that is not on the list', () => {
    expect(decide('https://rutiini.fi', 'https://evil.example')).toBe(false);
  });

  it('always allows the mobile builds, which are the product itself', () => {
    for (const origin of NATIVE_ORIGINS) {
      expect(decide('https://rutiini.fi', origin)).toBe(true);
    }
  });

  it('keeps the previous permissive behaviour when nothing is configured', () => {
    expect(decide(undefined, 'https://anything.example')).toBe(true);
    expect(decide('', 'https://anything.example')).toBe(true);
  });

  it('ignores a trailing slash on either side', () => {
    expect(decide('https://rutiini.fi/', 'https://rutiini.fi')).toBe(true);
  });
});
