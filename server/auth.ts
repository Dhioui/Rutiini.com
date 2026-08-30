/**
 * Authentication and Authorization utilities for Rutiini daycare system
 * This module provides reusable authorization logic that matches routes.ts behavior
 */

import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { User } from '@shared/schema';

/**
 * Signing key for session tokens.
 *
 * This previously fell back to a hardcoded literal when JWT_SECRET was unset.
 * Anyone who knew that string could mint a valid token for any user id and read
 * any daycare's children, so a deployment that simply forgot the environment
 * variable was silently unauthenticated. Production now refuses to start instead.
 *
 * Outside production a random key is generated per process, so development and
 * tests need no configuration; restarting invalidates previously issued tokens,
 * which is the correct trade-off there.
 */
const JWT_SECRET: string = (() => {
  const configured = process.env.JWT_SECRET;

  if (process.env.NODE_ENV === 'production') {
    if (!configured || configured.trim().length === 0) {
      throw new Error(
        'JWT_SECRET must be set in production. Generate one with: openssl rand -base64 48'
      );
    }
    if (configured === 'rutiini-secret-key') {
      throw new Error(
        'JWT_SECRET is still the old built-in default and is publicly known. ' +
        'Generate a new one with: openssl rand -base64 48'
      );
    }
    if (configured.length < 32) {
      throw new Error('JWT_SECRET must be at least 32 characters. Generate one with: openssl rand -base64 48');
    }
    return configured;
  }

  return configured && configured.trim().length > 0
    ? configured
    : crypto.randomBytes(48).toString('base64');
})();
const BCRYPT_ROUNDS = 10;
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

export type UserRole = 'super_admin' | 'daycareleader' | 'admin' | 'staff' | 'guardian';

// Strong password policy: 8+ chars, uppercase, lowercase, number, special character
export const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;

/**
 * GDPR: Super admin does NOT have access to personal data through this function
 * This is the core multi-tenant isolation check
 */
export function canAccessDaycare(user: User, daycareId: number): boolean {
  return user.daycareId === daycareId;
}

/**
 * Check if user has one of the specified roles
 */
export function hasRole(user: User, ...roles: UserRole[]): boolean {
  return roles.includes(user.role as UserRole);
}

/**
 * GDPR: Super admin cannot view personal data (children, entries, etc.)
 */
export function canViewPersonalData(user: User): boolean {
  return user.role !== 'super_admin';
}

/**
 * Children access - super_admin cannot view, all others can
 */
export function canViewChildren(user: User): boolean {
  if (user.role === 'super_admin') return false;
  return ['daycareleader', 'admin', 'staff', 'guardian'].includes(user.role);
}

/**
 * Only daycareleader can create children
 */
export function canCreateChildren(user: User): boolean {
  return user.role === 'daycareleader';
}

/**
 * Entries access - super_admin cannot access
 */
export function canAccessEntries(user: User): boolean {
  if (user.role === 'super_admin') return false;
  return ['daycareleader', 'admin', 'staff', 'guardian'].includes(user.role);
}

/**
 * Only staff, admin, daycareleader can create entries
 */
export function canCreateEntries(user: User): boolean {
  return ['daycareleader', 'admin', 'staff'].includes(user.role);
}

/**
 * Only guardians can report absences
 */
export function canReportAbsences(user: User): boolean {
  return user.role === 'guardian';
}

/**
 * User management - admin and daycareleader only
 */
export function canManageUsers(user: User): boolean {
  return ['admin', 'daycareleader'].includes(user.role);
}

/**
 * Which role a caller may give to an account they create.
 *
 * Being allowed to create accounts is not the same as being allowed to create
 * any account. Staff add guardians as children enrol, which is ordinary daily
 * work; letting them also mint a daycare leader would hand them, in one request,
 * every permission staff is deliberately denied -- removing children, exporting
 * the roster, reading the audit log -- since they choose the new password too.
 *
 * Super admin is never creatable here. It is provisioned separately and is the
 * one role that reaches across daycares.
 */
export function canCreateRole(user: User, role: UserRole): boolean {
  if (role === 'super_admin') return false;

  if (['admin', 'daycareleader'].includes(user.role)) return true;
  if (user.role === 'staff') return role === 'guardian';
  return false;
}

/**
 * CSV export - only daycareleader (GDPR data controller)
 */
export function canExportData(user: User): boolean {
  return user.role === 'daycareleader';
}

/**
 * Daycare management - only super_admin
 */
export function canManageDaycares(user: User): boolean {
  return user.role === 'super_admin';
}

/**
 * Audit log access - admin, daycareleader, super_admin
 */
export function canViewAuditLogs(user: User): boolean {
  return ['admin', 'daycareleader', 'super_admin'].includes(user.role);
}

/**
 * Form management - admin and daycareleader
 */
export function canManageForms(user: User): boolean {
  return ['admin', 'daycareleader'].includes(user.role);
}

/**
 * Form submission - guardians only
 */
export function canSubmitForms(user: User): boolean {
  return user.role === 'guardian';
}

/**
 * Hash password with bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/**
 * Verify password against hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Generate JWT token for user
 */
export function generateToken(userId: number, expiresInSeconds: number = 86400): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: expiresInSeconds });
}

/**
 * Verify JWT token and return decoded payload
 */
export function verifyToken(token: string): { userId: number } | null {
  try {
    return jwt.verify(token, JWT_SECRET) as { userId: number };
  } catch {
    return null;
  }
}

/**
 * Hash session token for database storage
 */
export function hashSessionToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Generate password reset token
 */
export function generateResetToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Hash entity ID for GDPR-compliant audit logging
 */
export function hashEntityId(entityId: number | string): string {
  return crypto.createHash('sha256').update(String(entityId)).digest('hex').substring(0, 16);
}

/**
 * Check if account is locked
 */
export function isAccountLocked(failedAttempts: number, lockedUntil: Date | null): boolean {
  if (failedAttempts < MAX_FAILED_ATTEMPTS) return false;
  if (!lockedUntil) return false;
  return new Date(lockedUntil) > new Date();
}

/**
 * Calculate lockout expiration time
 */
export function calculateLockoutExpiration(): Date {
  return new Date(Date.now() + LOCKOUT_DURATION_MS);
}

/**
 * Validate password strength
 */
export function isStrongPassword(password: string): boolean {
  return strongPasswordRegex.test(password);
}

export { MAX_FAILED_ATTEMPTS, LOCKOUT_DURATION_MS };
