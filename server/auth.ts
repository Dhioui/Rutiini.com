/**
 * Authentication and Authorization utilities for Rutiini daycare system
 * This module provides reusable authorization logic that matches routes.ts behavior
 */

import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { User } from '@shared/schema';

const JWT_SECRET = process.env.JWT_SECRET || 'rutiini-secret-key';
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
