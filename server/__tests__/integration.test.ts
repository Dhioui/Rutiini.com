/**
 * Integration tests for authentication and authorization flows
 * These tests verify that the production auth.ts functions are correctly
 * integrated with the application's authentication flow.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  hashPassword,
  verifyPassword,
  generateToken,
  verifyToken,
  hashSessionToken,
  isAccountLocked,
  calculateLockoutExpiration,
  MAX_FAILED_ATTEMPTS,
  LOCKOUT_DURATION_MS,
} from '../auth';

describe('Authentication Flow Integration', () => {
  describe('Password -> Hash -> Verify flow', () => {
    it('should complete full password lifecycle', async () => {
      const originalPassword = 'SecurePass123!';
      
      // Step 1: Hash password (as done during user creation)
      const hash = await hashPassword(originalPassword);
      
      // Step 2: Verify password on login
      const isValid = await verifyPassword(originalPassword, hash);
      expect(isValid).toBe(true);
      
      // Step 3: Reject wrong password
      const isWrongValid = await verifyPassword('WrongPass456!', hash);
      expect(isWrongValid).toBe(false);
    });
  });

  describe('Token -> Session -> Invalidate flow', () => {
    it('should complete full session lifecycle', () => {
      const userId = 42;
      
      // Step 1: Generate JWT token on login
      const token = generateToken(userId);
      expect(token).toBeDefined();
      
      // Step 2: Verify token on subsequent requests
      const decoded = verifyToken(token);
      expect(decoded?.userId).toBe(userId);
      
      // Step 3: Hash token for session storage
      const sessionHash = hashSessionToken(token);
      expect(sessionHash.length).toBe(64);
      
      // Step 4: Same token produces same hash (for logout lookup)
      const sessionHash2 = hashSessionToken(token);
      expect(sessionHash).toBe(sessionHash2);
    });
  });

  describe('Account Lockout flow', () => {
    it('should not lock account on first failure', () => {
      expect(isAccountLocked(1, null)).toBe(false);
    });

    it('should not lock account under threshold', () => {
      expect(isAccountLocked(MAX_FAILED_ATTEMPTS - 1, null)).toBe(false);
    });

    it('should lock account at threshold with lockout time', () => {
      const lockUntil = calculateLockoutExpiration();
      expect(isAccountLocked(MAX_FAILED_ATTEMPTS, lockUntil)).toBe(true);
    });

    it('should unlock account after lockout expires', () => {
      const expiredLockout = new Date(Date.now() - 1000);
      expect(isAccountLocked(MAX_FAILED_ATTEMPTS, expiredLockout)).toBe(false);
    });

    it('should maintain consistent lockout duration', () => {
      const before = Date.now();
      const lockoutTime = calculateLockoutExpiration();
      const after = Date.now();
      
      const expectedMin = before + LOCKOUT_DURATION_MS;
      const expectedMax = after + LOCKOUT_DURATION_MS;
      
      expect(lockoutTime.getTime()).toBeGreaterThanOrEqual(expectedMin);
      expect(lockoutTime.getTime()).toBeLessThanOrEqual(expectedMax);
    });
  });

  describe('Password Reset flow', () => {
    it('should complete reset token lifecycle', async () => {
      const { generateResetToken, hashSessionToken } = await import('../auth');
      
      // Step 1: Generate reset token
      const resetToken = generateResetToken();
      expect(resetToken.length).toBe(64);
      
      // Step 2: Hash for storage
      const tokenHash = hashSessionToken(resetToken);
      expect(tokenHash.length).toBe(64);
      
      // Step 3: Same token produces same hash
      const tokenHash2 = hashSessionToken(resetToken);
      expect(tokenHash).toBe(tokenHash2);
      
      // Step 4: New reset produces new token
      const newResetToken = generateResetToken();
      expect(newResetToken).not.toBe(resetToken);
    });
  });

  describe('Authorization Integration', () => {
    it('should verify canAccessDaycare is used for multi-tenant isolation', async () => {
      const { canAccessDaycare } = await import('../auth');
      
      const user = {
        id: 1,
        name: 'Test',
        email: 'test@test.com',
        passwordHash: 'hash',
        role: 'staff',
        daycareId: 1,
        passwordNeedsReset: false,
        passwordChangedAt: null,
        resetTokenHash: null,
        resetTokenExpiresAt: null,
        lastLoginAt: null,
        failedLoginAttempts: 0,
        lockedUntil: null,
        createdAt: new Date(),
      };
      
      // Can access own daycare
      expect(canAccessDaycare(user, 1)).toBe(true);
      
      // Cannot access other daycare
      expect(canAccessDaycare(user, 2)).toBe(false);
    });

    it('should verify GDPR restrictions on super_admin', async () => {
      const { canViewChildren, canAccessEntries, canManageDaycares } = await import('../auth');
      
      const superAdmin = {
        id: 1,
        name: 'Super Admin',
        email: 'admin@system.com',
        passwordHash: 'hash',
        role: 'super_admin',
        daycareId: null,
        passwordNeedsReset: false,
        passwordChangedAt: null,
        resetTokenHash: null,
        resetTokenExpiresAt: null,
        lastLoginAt: null,
        failedLoginAttempts: 0,
        lockedUntil: null,
        createdAt: new Date(),
      };
      
      // Cannot view personal data (GDPR)
      expect(canViewChildren(superAdmin)).toBe(false);
      expect(canAccessEntries(superAdmin)).toBe(false);
      
      // Can manage daycares (non-personal data)
      expect(canManageDaycares(superAdmin)).toBe(true);
    });
  });
});

describe('VAHTI Security Compliance', () => {
  it('should enforce 5 failed attempts limit', () => {
    expect(MAX_FAILED_ATTEMPTS).toBe(5);
  });

  it('should enforce 15 minute lockout duration', () => {
    expect(LOCKOUT_DURATION_MS).toBe(15 * 60 * 1000);
  });

  it('should use bcrypt with sufficient rounds', async () => {
    const password = 'Test123!';
    const hash = await hashPassword(password);
    
    // Bcrypt hash starts with $2b$ or $2a$ and includes rounds info
    expect(hash).toMatch(/^\$2[ab]\$\d{2}\$/);
    
    // Verify rounds is at least 10
    const roundsMatch = hash.match(/^\$2[ab]\$(\d{2})\$/);
    expect(roundsMatch).not.toBeNull();
    const rounds = parseInt(roundsMatch![1]);
    expect(rounds).toBeGreaterThanOrEqual(10);
  });
});
