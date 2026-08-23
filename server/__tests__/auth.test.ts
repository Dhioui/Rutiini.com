import { describe, it, expect } from 'vitest';

// Import actual production authentication functions from server/auth.ts
import {
  hashPassword,
  verifyPassword,
  generateToken,
  verifyToken,
  hashSessionToken,
  generateResetToken,
  hashEntityId,
  isAccountLocked,
  calculateLockoutExpiration,
  isStrongPassword,
  strongPasswordRegex,
  MAX_FAILED_ATTEMPTS,
  LOCKOUT_DURATION_MS,
} from '../auth';

describe('Password Hashing (Production Functions)', () => {
  it('should hash password with bcrypt', async () => {
    const password = 'TestPassword123!';
    const hash = await hashPassword(password);
    
    expect(hash).toBeDefined();
    expect(hash).not.toBe(password);
    expect(hash.length).toBeGreaterThan(50);
  });

  it('should verify correct password', async () => {
    const password = 'TestPassword123!';
    const hash = await hashPassword(password);
    
    const isValid = await verifyPassword(password, hash);
    expect(isValid).toBe(true);
  });

  it('should reject incorrect password', async () => {
    const password = 'TestPassword123!';
    const wrongPassword = 'WrongPassword456!';
    const hash = await hashPassword(password);
    
    const isValid = await verifyPassword(wrongPassword, hash);
    expect(isValid).toBe(false);
  });

  it('should produce different hashes for same password', async () => {
    const password = 'TestPassword123!';
    const hash1 = await hashPassword(password);
    const hash2 = await hashPassword(password);
    
    expect(hash1).not.toBe(hash2);
  });
});

describe('JWT Token Management (Production Functions)', () => {
  it('should generate valid JWT token', () => {
    const userId = 1;
    const token = generateToken(userId);
    
    expect(token).toBeDefined();
    expect(token.split('.')).toHaveLength(3);
  });

  it('should decode JWT token correctly', () => {
    const userId = 123;
    const token = generateToken(userId);
    
    const decoded = verifyToken(token);
    
    expect(decoded).not.toBeNull();
    expect(decoded?.userId).toBe(123);
  });

  it('should return null for invalid JWT token', () => {
    const invalidToken = 'invalid.token.here';
    
    const decoded = verifyToken(invalidToken);
    expect(decoded).toBeNull();
  });

  it('should return null for malformed token', () => {
    const malformedToken = 'not-a-jwt-at-all';
    
    const decoded = verifyToken(malformedToken);
    expect(decoded).toBeNull();
  });

  it('should respect custom expiration', () => {
    const userId = 1;
    const token = generateToken(userId, 3600);
    
    expect(token).toBeDefined();
    const decoded = verifyToken(token);
    expect(decoded?.userId).toBe(1);
  });
});

describe('Session Token Hashing (Production Functions)', () => {
  it('should hash session token with SHA256', () => {
    const token = 'test-session-token-12345';
    const hash = hashSessionToken(token);
    
    expect(hash).toBeDefined();
    expect(hash.length).toBe(64);
  });

  it('should produce same hash for same token', () => {
    const token = 'consistent-token';
    const hash1 = hashSessionToken(token);
    const hash2 = hashSessionToken(token);
    
    expect(hash1).toBe(hash2);
  });

  it('should produce different hash for different tokens', () => {
    const token1 = 'token-one';
    const token2 = 'token-two';
    const hash1 = hashSessionToken(token1);
    const hash2 = hashSessionToken(token2);
    
    expect(hash1).not.toBe(hash2);
  });
});

describe('Password Reset Token (Production Functions)', () => {
  it('should generate random reset token', () => {
    const token = generateResetToken();
    
    expect(token).toBeDefined();
    expect(token.length).toBe(64);
  });

  it('should generate unique tokens each time', () => {
    const token1 = generateResetToken();
    const token2 = generateResetToken();
    
    expect(token1).not.toBe(token2);
  });
});

describe('Entity ID Hashing for GDPR (Production Functions)', () => {
  it('should hash entity ID for audit logs', () => {
    const entityId = 12345;
    const hash = hashEntityId(entityId);
    
    expect(hash).toBeDefined();
    expect(hash.length).toBe(16);
  });

  it('should produce same hash for same ID', () => {
    const entityId = 67890;
    const hash1 = hashEntityId(entityId);
    const hash2 = hashEntityId(entityId);
    
    expect(hash1).toBe(hash2);
  });

  it('should produce different hash for different IDs', () => {
    const hash1 = hashEntityId(1);
    const hash2 = hashEntityId(2);
    
    expect(hash1).not.toBe(hash2);
  });

  it('should handle string entity IDs', () => {
    const hash = hashEntityId('user-abc-123');
    
    expect(hash).toBeDefined();
    expect(hash.length).toBe(16);
  });
});

describe('Password Validation (Production Functions)', () => {
  it('should accept strong password', () => {
    const password = 'StrongPass123!';
    expect(isStrongPassword(password)).toBe(true);
  });

  it('should reject password without uppercase', () => {
    const password = 'weakpass123!';
    expect(isStrongPassword(password)).toBe(false);
  });

  it('should reject password without lowercase', () => {
    const password = 'WEAKPASS123!';
    expect(isStrongPassword(password)).toBe(false);
  });

  it('should reject password without number', () => {
    const password = 'WeakPassword!';
    expect(isStrongPassword(password)).toBe(false);
  });

  it('should reject password without special char', () => {
    const password = 'WeakPass123';
    expect(isStrongPassword(password)).toBe(false);
  });

  it('should reject password shorter than 8 chars', () => {
    const password = 'Weak1!';
    expect(isStrongPassword(password)).toBe(false);
  });

  it('should accept various special characters', () => {
    const passwords = [
      'TestPass123!',
      'TestPass123@',
      'TestPass123#',
      'TestPass123$',
      'TestPass123%',
      'TestPass123_',
    ];
    
    for (const password of passwords) {
      expect(isStrongPassword(password)).toBe(true);
    }
  });
});

describe('Account Lockout Logic (Production Functions)', () => {
  it('should not lock account under max attempts', () => {
    expect(isAccountLocked(3, null)).toBe(false);
  });

  it('should not lock without lockedUntil date', () => {
    expect(isAccountLocked(5, null)).toBe(false);
  });

  it('should lock account at max attempts with valid lockout', () => {
    const lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
    expect(isAccountLocked(MAX_FAILED_ATTEMPTS, lockedUntil)).toBe(true);
  });

  it('should unlock account after lockout expires', () => {
    const expiredLockout = new Date(Date.now() - 1000);
    expect(isAccountLocked(MAX_FAILED_ATTEMPTS, expiredLockout)).toBe(false);
  });

  it('should calculate correct lockout expiration', () => {
    const before = Date.now();
    const lockoutExpiration = calculateLockoutExpiration();
    const after = Date.now();
    
    const lockoutTime = lockoutExpiration.getTime();
    expect(lockoutTime).toBeGreaterThanOrEqual(before + LOCKOUT_DURATION_MS);
    expect(lockoutTime).toBeLessThanOrEqual(after + LOCKOUT_DURATION_MS);
  });

  it('should have 5 max failed attempts (VAHTI compliance)', () => {
    expect(MAX_FAILED_ATTEMPTS).toBe(5);
  });

  it('should have 15 minute lockout duration', () => {
    expect(LOCKOUT_DURATION_MS).toBe(15 * 60 * 1000);
  });
});

describe('Strong Password Regex (Production)', () => {
  it('should be exported for use in schemas', () => {
    expect(strongPasswordRegex).toBeDefined();
    expect(strongPasswordRegex instanceof RegExp).toBe(true);
  });

  it('should match strong passwords', () => {
    expect(strongPasswordRegex.test('ValidPass123!')).toBe(true);
  });

  it('should not match weak passwords', () => {
    expect(strongPasswordRegex.test('weak')).toBe(false);
  });
});
