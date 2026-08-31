import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage, hashEntityId } from "./storage";
import { readPagination, LIST_LIMITS } from "./pagination";
import { sendEmail } from "./email";
import { sendPushToUsers } from "./push";
import { getCached, setCache, invalidateCache } from "./db";
import { csvFile } from "./csv";
import fs from "fs";
import path from "path";
import { loginSchema, superAdminLoginSchema, insertChildSchema, updateChildSchema, insertReservationSchema, reservationTemplateSchema, applyTemplateSchema, checkInSchema, checkOutSchema, insertChildContractSchema, insertEntrySchema, insertTripSchema, insertTripResponseSchema, createUserSchema, insertDaycareSchema, insertAbsenceSchema, insertMessageSchema, insertDocumentSchema, insertDaycareGroupSchema, changePasswordSchema, insertFormSchema, insertFormSubmissionSchema, insertChildConsentSchema, insertMunicipalitySchema, updateMunicipalitySchema } from "@shared/schema";
import type { User, Child, MealMenu } from "@shared/schema";
import { getTodaysMenu, fetchAndSaveMenu, fetchAndSaveMenuForDaycare, dietInfoLegend } from "./menuScraper";
import {
  canAccessDaycare,
  canCreateRole,
  hasRole,
  canViewPersonalData,
  canViewChildren,
  canCreateChildren,
  canAccessEntries,
  canCreateEntries,
  canReportAbsences,
  canManageUsers,
  canExportData,
  canManageDaycares,
  canViewAuditLogs,
  canManageForms,
  canSubmitForms,
  hashPassword,
  verifyPassword,
  generateToken,
  verifyToken,
  hashSessionToken,
  generateResetToken,
  isAccountLocked,
  calculateLockoutExpiration,
  isStrongPassword,
  MAX_FAILED_ATTEMPTS,
} from "./auth";
import {
  isReservationLocked,
  reservationDeadline,
  reservedMinutes,
  realisedMinutes,
  isPresent,
  isoWeekday,
  monthBounds,
  careTimeAccessDenial,
  canActOnChild,
  zonedDate,
} from "./careTime";

// GDPR compliance: Super admin cannot access personal data
const GDPR_DENIAL_MESSAGE = "Sinulla ei ole oikeuksia nähdä tätä sisältöä (GDPR)";

// Helper to log audit events (no personal data)
async function logAudit(
  actorId: number | null,
  actorRole: string,
  daycareId: number | null,
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' | 'VIEW' | 'ACCESS_DENIED',
  entityType: string,
  entityId?: number | string,
  metadata?: Record<string, any>
) {
  try {
    await storage.createAuditLog({
      actorId,
      actorRole,
      daycareId,
      action,
      entityType,
      entityIdHash: entityId ? hashEntityId(entityId) : undefined,
      metadata,
    });
  } catch (e) {
    console.error('Failed to log audit event:', e);
  }
}

interface AuthRequest extends Request {
  user?: User;
}

/**
 * Public address of this deployment, used to build links in outgoing email.
 *
 * A reset link pointing at localhost is useless to the person who receives it, so
 * this must name the address users actually reach.
 */
const APP_URL = (process.env.APP_URL || 'http://localhost:5000').replace(/\/+$/, '');

/** How long a signed-in session lasts, for both the JWT and its session-token row. */
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

/**
 * A Content-Disposition value that survives the trip.
 *
 * Two of the report filenames are Finnish -- "merkinnät", "läsnäolo" -- and were
 * written straight into the header. HTTP header values are Latin-1, so a raw ä
 * there is not something a client can be expected to read back correctly, and
 * whether it survives depends on the client. RFC 5987 is the defined way to say
 * it: a plain ASCII form for anything old, and an explicitly UTF-8 encoded form
 * beside it. Anyone calling the endpoint directly now gets the real name.
 */
function attachment(filename: string): string {
  const ascii = filename.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '');
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

async function authenticateToken(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = verifyToken(token);
    if (!decoded) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Single round trip: the user row and the session token are fetched together.
    // This middleware runs on every authenticated request, so the second query was
    // pure added latency on every call.
    const sessionTokenHashValue = hashSessionToken(token);
    const session = await storage.getUserBySessionToken(sessionTokenHashValue);

    if (!session) {
      return res.status(401).json({ error: 'Session expired or invalidated' });
    }

    // The JWT and the stored session must refer to the same user. Without this the
    // token subject is never checked against the session row it was matched to.
    if (session.user.id !== decoded.userId) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Check if session token has expired
    if (new Date(session.sessionToken.expiresAt) < new Date()) {
      await storage.deleteSessionToken(sessionTokenHashValue);
      return res.status(401).json({ error: 'Session expired' });
    }

    req.user = session.user;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// Authorization helper: canAccessDaycare is now imported from ./auth


export async function registerRoutes(app: Express): Promise<Server> {
  // Health check endpoint for monitoring (no auth required)
  app.get('/api/health', async (req: Request, res: Response) => {
    try {
      // Basic health check - verify database connection
      const dbHealthy = await storage.checkDatabaseConnection();
      
      const healthStatus = {
        status: dbHealthy ? 'ok' : 'degraded',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: process.env.npm_package_version || '1.0.0',
        database: dbHealthy ? 'connected' : 'disconnected',
      };
      
      const statusCode = dbHealthy ? 200 : 503;
      res.status(statusCode).json(healthStatus);
    } catch (error) {
      res.status(503).json({
        status: 'error',
        timestamp: new Date().toISOString(),
        error: 'Health check failed',
      });
    }
  });

  // Kubernetes/Load Balancer standard health check endpoint (no auth required)
  // Returns 200 OK if app is running, 503 if database is down
  app.get('/healthz', async (req: Request, res: Response) => {
    try {
      const dbHealthy = await storage.checkDatabaseConnection();
      if (dbHealthy) {
        res.status(200).send('OK');
      } else {
        res.status(503).send('Database unavailable');
      }
    } catch (error) {
      res.status(503).send('Service unavailable');
    }
  });

  // Liveness probe - simple check if app is running (no auth required)
  app.get('/livez', (req: Request, res: Response) => {
    res.status(200).send('OK');
  });

  // Readiness probe - checks if app is ready to serve traffic (no auth required)
  app.get('/readyz', async (req: Request, res: Response) => {
    try {
      const dbHealthy = await storage.checkDatabaseConnection();
      if (dbHealthy) {
        res.status(200).send('OK');
      } else {
        res.status(503).send('Not ready');
      }
    } catch (error) {
      res.status(503).send('Not ready');
    }
  });

  // Version info endpoint (no auth required)
  app.get('/api/version', (req: Request, res: Response) => {
    res.json({
      version: '1.5.0',
      build: '5',
      buildDate: '2024-12-04',
      environment: process.env.NODE_ENV || 'development',
    });
  });

  // Public API endpoints for municipality-based login flow (no auth required)
  // GET /api/public/municipalities - returns list of unique municipalities (cached 5 min)
  app.get('/api/public/municipalities', async (req: Request, res: Response) => {
    try {
      const cacheKey = 'public:municipalities';
      const cached = getCached<string[]>(cacheKey);
      if (cached) {
        res.setHeader('X-Cache', 'HIT');
        res.setHeader('Cache-Control', 'public, max-age=300');
        return res.json(cached);
      }
      
      const municipalities = await storage.getUniqueMunicipalities();
      setCache(cacheKey, municipalities, 5 * 60 * 1000); // 5 min cache
      res.setHeader('X-Cache', 'MISS');
      res.setHeader('Cache-Control', 'public, max-age=300');
      res.json(municipalities);
    } catch (error) {
      console.error('Failed to fetch municipalities:', error);
      res.status(500).json({ error: 'Failed to fetch municipalities' });
    }
  });

  // GET /api/public/daycares?municipality=Helsinki - returns daycares for a municipality (cached 5 min)
  app.get('/api/public/daycares', async (req: Request, res: Response) => {
    try {
      const { municipality } = req.query;
      
      if (!municipality || typeof municipality !== 'string') {
        return res.status(400).json({ error: 'Municipality parameter required' });
      }
      
      const cacheKey = `public:daycares:${municipality}`;
      const cached = getCached<Array<{id: number; name: string; code: string}>>(cacheKey);
      if (cached) {
        res.setHeader('X-Cache', 'HIT');
        res.setHeader('Cache-Control', 'public, max-age=300');
        return res.json(cached);
      }
      
      const daycares = await storage.getDaycaresByMunicipality(municipality);
      const publicData = daycares.map(d => ({
        id: d.id,
        name: d.name,
        code: d.code,
      }));
      setCache(cacheKey, publicData, 5 * 60 * 1000); // 5 min cache
      res.setHeader('X-Cache', 'MISS');
      res.setHeader('Cache-Control', 'public, max-age=300');
      res.json(publicData);
    } catch (error) {
      console.error('Failed to fetch daycares by municipality:', error);
      res.status(500).json({ error: 'Failed to fetch daycares' });
    }
  });

  // Public routes
  app.get('/privacy-policy', (req: Request, res: Response) => {
    try {
      // Try multiple possible paths for reliability in dev and production
      const possiblePaths = [
        path.resolve(import.meta.dirname, '../dist/public/privacy-policy.html'),
        path.resolve(process.cwd(), 'dist/public/privacy-policy.html'),
        path.join(process.cwd(), 'dist', 'public', 'privacy-policy.html'),
      ];
      
      let filePath: string | null = null;
      for (const tryPath of possiblePaths) {
        if (fs.existsSync(tryPath)) {
          filePath = tryPath;
          break;
        }
      }
      
      if (!filePath) {
        throw new Error('Privacy policy file not found in any expected location');
      }
      
      const content = fs.readFileSync(filePath, 'utf-8');
      res.set('Content-Type', 'text/html');
      res.send(content);
    } catch (error) {
      console.error('Privacy policy error:', error);
      res.status(500).send('Privacy policy not found');
    }
  });

  app.get('/api/daycares/:code', async (req: Request, res: Response) => {
    try {
      const { code } = req.params;
      const daycare = await storage.getDaycareByCode(code.toLowerCase());
      
      if (!daycare) {
        return res.status(404).json({ error: 'Daycare not found' });
      }
      
      res.json({
        id: daycare.id,
        name: daycare.name,
        code: daycare.code
      });
    } catch (error) {
      res.status(500).json({ error: 'Server error' });
    }
  });

  app.post('/api/auth/login/:role', async (req: Request, res: Response) => {
    try {
      const { role } = req.params;
      const validatedData = loginSchema.parse(req.body);
      
      // Validate daycare code
      const daycare = await storage.getDaycareByCode(validatedData.daycareCode);
      if (!daycare) {
        return res.status(401).json({ error: 'Invalid daycare code' });
      }
      
      const user = await storage.getUserByEmail(validatedData.email);
      
      if (!user || user.role !== role) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      
      // Verify user belongs to this daycare
      if (user.daycareId !== daycare.id) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      
      // VAHTI: Check if account is locked
      const isLocked = await storage.isUserLocked(user.id);
      if (isLocked) {
        await logAudit(user.id, user.role, user.daycareId, 'ACCESS_DENIED', 'session', undefined, { reason: 'account_locked' });
        return res.status(423).json({ error: 'Account is temporarily locked. Please try again later.' });
      }
      
      const isValidPassword = await verifyPassword(validatedData.password, user.passwordHash);
      
      if (!isValidPassword) {
        // VAHTI: Increment failed login attempts
        const failedAttempts = await storage.incrementFailedLoginAttempts(user.id);
        await logAudit(user.id, user.role, user.daycareId, 'ACCESS_DENIED', 'session', undefined, { reason: 'invalid_password', failedAttempts });
        
        // Lock account after MAX_FAILED_ATTEMPTS (15 minutes)
        if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
          const lockUntil = calculateLockoutExpiration();
          await storage.lockUserAccount(user.id, lockUntil);
          await logAudit(user.id, user.role, user.daycareId, 'UPDATE', 'account_lock', undefined, { lockUntil: lockUntil.toISOString() });
          return res.status(423).json({ error: 'Account locked due to too many failed attempts. Please try again in 15 minutes.' });
        }
        
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      
      // Reset failed login attempts on successful login
      await storage.resetFailedLoginAttempts(user.id);
      
      const token = generateToken(user.id, SESSION_TTL_SECONDS);
      
      // Create session token for secure logout
      const tokenHash = hashSessionToken(token);
      const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);
      await storage.createSessionToken(user.id, tokenHash, expiresAt);
      
      // Update last login timestamp
      await storage.updateLastLogin(user.id);
      
      // Audit: Log successful login
      await logAudit(user.id, user.role, user.daycareId, 'LOGIN', 'session', undefined, { ipAddress: req.ip });
      
      res.json({ 
        token, 
        user: { 
          id: user.id, 
          name: user.name, 
          email: user.email, 
          role: user.role,
          daycareId: user.daycareId,
          passwordNeedsReset: user.passwordNeedsReset
        },
        daycare: {
          id: daycare.id,
          name: daycare.name,
          code: daycare.code
        }
      });
    } catch (error) {
      res.status(400).json({ error: 'Invalid request' });
    }
  });

  app.post('/api/auth/super-admin/login', async (req: Request, res: Response) => {
    try {
      const validatedData = superAdminLoginSchema.parse(req.body);
      
      const user = await storage.getUserByEmail(validatedData.email);
      
      if (!user || user.role !== 'super_admin') {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      
      // VAHTI: Check if account is locked
      const isLocked = await storage.isUserLocked(user.id);
      if (isLocked) {
        await logAudit(user.id, user.role, null, 'ACCESS_DENIED', 'session', undefined, { reason: 'account_locked' });
        return res.status(423).json({ error: 'Account is temporarily locked. Please try again later.' });
      }
      
      const isValidPassword = await verifyPassword(validatedData.password, user.passwordHash);
      
      if (!isValidPassword) {
        // VAHTI: Increment failed login attempts
        const failedAttempts = await storage.incrementFailedLoginAttempts(user.id);
        await logAudit(user.id, user.role, null, 'ACCESS_DENIED', 'session', undefined, { reason: 'invalid_password', failedAttempts });
        
        // Lock account after MAX_FAILED_ATTEMPTS (15 minutes)
        if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
          const lockUntil = calculateLockoutExpiration();
          await storage.lockUserAccount(user.id, lockUntil);
          await logAudit(user.id, user.role, null, 'UPDATE', 'account_lock', undefined, { lockUntil: lockUntil.toISOString() });
          return res.status(423).json({ error: 'Account locked due to too many failed attempts. Please try again in 15 minutes.' });
        }
        
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      
      // Reset failed login attempts on successful login
      await storage.resetFailedLoginAttempts(user.id);
      
      const token = generateToken(user.id, SESSION_TTL_SECONDS);
      
      // Create session token for secure logout
      const tokenHash = hashSessionToken(token);
      const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);
      await storage.createSessionToken(user.id, tokenHash, expiresAt);
      
      // Update last login timestamp
      await storage.updateLastLogin(user.id);
      
      // Audit: Log super admin login
      await logAudit(user.id, user.role, null, 'LOGIN', 'session', undefined, { ipAddress: req.ip });
      
      res.json({ 
        token, 
        user: { 
          id: user.id, 
          name: user.name, 
          email: user.email, 
          role: user.role,
          daycareId: user.daycareId,
          passwordNeedsReset: user.passwordNeedsReset
        }
      });
    } catch (error) {
      res.status(400).json({ error: 'Invalid request' });
    }
  });

  // Logout endpoint - invalidates session token
  app.post('/api/auth/logout', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const user = req.user!;
      const authHeader = req.headers['authorization'];
      const token = authHeader && authHeader.split(' ')[1];
      
      if (token) {
        const tokenHash = hashSessionToken(token);
        await storage.deleteSessionToken(tokenHash);
      }
      
      // Audit: Log logout
      await logAudit(user.id, user.role, user.daycareId, 'LOGOUT', 'session');
      
      res.json({ success: true, message: 'Logged out successfully' });
    } catch (error) {
      res.status(500).json({ error: 'Logout failed' });
    }
  });

  // Admin unlock account endpoint
  app.post('/api/admin/users/:userId/unlock', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const admin = req.user!;
      const { userId } = req.params;
      
      // Only admins and super admins can unlock accounts
      if (admin.role !== 'daycareleader' && admin.role !== 'super_admin') {
        return res.status(403).json({ error: 'Forbidden' });
      }
      
      const targetUser = await storage.getUser(parseInt(userId));
      if (!targetUser) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      // Daycare leaders can only unlock users in their daycare
      if (admin.role === 'daycareleader' && targetUser.daycareId !== admin.daycareId) {
        return res.status(403).json({ error: 'Forbidden' });
      }
      
      await storage.unlockUserAccount(targetUser.id);
      
      await logAudit(admin.id, admin.role, admin.daycareId, 'UPDATE', 'account_unlock', targetUser.id);
      
      res.json({ success: true, message: 'Account unlocked successfully' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to unlock account' });
    }
  });

  // Password change endpoint (for first login or voluntary change)
  app.post('/api/auth/change-password', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const user = req.user!;
      const validatedData = changePasswordSchema.parse(req.body);
      
      // Verify current password
      const isValidPassword = await verifyPassword(validatedData.currentPassword, user.passwordHash);
      if (!isValidPassword) {
        return res.status(401).json({ error: 'Current password is incorrect' });
      }
      
      // Security: Ensure new password is different from current
      const isSamePassword = await verifyPassword(validatedData.newPassword, user.passwordHash);
      if (isSamePassword) {
        return res.status(400).json({ error: 'New password must be different from current password' });
      }
      
      // Hash new password
      const newPasswordHash = await hashPassword(validatedData.newPassword);
      
      // Update password and clear passwordNeedsReset flag
      await storage.updateUserPassword(user.id, newPasswordHash);

      // Changing a password must end every other session. Someone who changes their
      // password because it may have leaked expects that to lock out whoever else
      // holds it; previously all existing sessions stayed valid for their full seven
      // days, so the password change accomplished nothing against an active intruder.
      await storage.deleteUserSessionTokens(user.id);

      // The caller's own session was just invalidated along with the rest, so issue a
      // replacement for this device. Without it the client is silently holding a dead
      // token, which is why the page used to sign the user out and send them back to
      // the very first screen after a change they were required to make.
      const token = generateToken(user.id, SESSION_TTL_SECONDS);
      await storage.createSessionToken(
        user.id,
        hashSessionToken(token),
        new Date(Date.now() + SESSION_TTL_SECONDS * 1000)
      );

      await logAudit(user.id, user.role, user.daycareId, 'UPDATE', 'password');
      
      res.json({ success: true, message: 'Password changed successfully', token });
    } catch (error) {
      res.status(400).json({ error: 'Invalid request' });
    }
  });

  // Password reset request (generates token)
  app.post('/api/auth/reset-password/request', async (req: Request, res: Response) => {
    try {
      const { email, daycareCode } = req.body;
      
      if (!email || !daycareCode) {
        return res.status(400).json({ error: 'Email and daycare code required' });
      }
      
      // Validate daycare
      const daycare = await storage.getDaycareByCode(daycareCode);
      if (!daycare) {
        // Don't reveal whether daycare exists
        return res.json({ success: true, message: 'If the account exists, a reset link has been sent' });
      }
      
      const user = await storage.getUserByEmail(email);
      
      // Don't reveal whether user exists
      if (!user || user.daycareId !== daycare.id) {
        return res.json({ success: true, message: 'If the account exists, a reset link has been sent' });
      }
      
      // Generate reset token
      const resetToken = generateResetToken();
      const resetTokenHash = hashSessionToken(resetToken);
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
      
      await storage.setPasswordResetToken(user.id, resetTokenHash, expiresAt);

      // The token used to be written to the server log with a note saying an email
      // would be sent in production. Nothing sent it, so the flow was a dead end,
      // and a credential that grants account access sat in logs that operations
      // staff and log shipping can read. It is now emailed and never logged.
      const resetUrl = `${APP_URL}/reset-password?token=${encodeURIComponent(resetToken)}`;
      await sendEmail({
        to: user.email,
        subject: 'Rutiini – salasanan palautus / password reset',
        text: [
          `Hei ${user.name},`,
          '',
          'Pyysit salasanan palautusta Rutiini-palveluun. Avaa alla oleva linkki:',
          resetUrl,
          '',
          'Linkki on voimassa yhden tunnin. Jos et pyytänyt palautusta, voit jättää',
          'tämän viestin huomiotta – salasanasi ei muutu.',
          '',
          '---',
          `Hello ${user.name},`,
          '',
          'You asked to reset your Rutiini password. Open the link below:',
          resetUrl,
          '',
          'The link is valid for one hour. If you did not request a reset you can',
          'ignore this message; your password will not change.',
        ].join('\n'),
      });

      await logAudit(null, 'system', user.daycareId, 'CREATE', 'password_reset_token');
      
      res.json({ success: true, message: 'If the account exists, a reset link has been sent' });
    } catch (error) {
      res.status(400).json({ error: 'Invalid request' });
    }
  });

  // Password reset with token
  app.post('/api/auth/reset-password', async (req: Request, res: Response) => {
    try {
      const { token, newPassword } = req.body;
      
      if (!token || !newPassword) {
        return res.status(400).json({ error: 'Token and new password required' });
      }
      
      if (newPassword.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters' });
      }
      
      // Hash the provided token to compare with stored hash
      const tokenHash = hashSessionToken(token);
      
      const user = await storage.getUserByResetToken(tokenHash);
      
      if (!user) {
        return res.status(400).json({ error: 'Invalid or expired reset token' });
      }
      
      // Check if token is expired
      if (user.resetTokenExpiresAt && new Date() > user.resetTokenExpiresAt) {
        await storage.clearPasswordResetToken(user.id);
        return res.status(400).json({ error: 'Reset token has expired' });
      }
      
      // Hash new password and update
      const newPasswordHash = await hashPassword(newPassword);
      await storage.updateUserPassword(user.id, newPasswordHash);

      // Spend the token. Without this the link in the email kept working for its
      // full hour, so anyone who later read that mailbox -- or a forwarded copy of
      // the message -- could set the password again.
      await storage.clearPasswordResetToken(user.id);

      // A reset is how someone recovers an account they may have lost control of,
      // so it has to end every session, not just set a new password. Otherwise
      // whoever was already signed in stays signed in for another seven days.
      await storage.deleteUserSessionTokens(user.id);

      await logAudit(user.id, user.role, user.daycareId, 'UPDATE', 'password', undefined, { via: 'reset_token' });
      
      res.json({ success: true, message: 'Password has been reset successfully' });
    } catch (error) {
      res.status(400).json({ error: 'Invalid request' });
    }
  });

  app.get('/api/children', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const user = req.user!;
      
      // GDPR: Super admin cannot access personal data
      if (user.role === 'super_admin') {
        await logAudit(user.id, user.role, null, 'ACCESS_DENIED', 'children');
        return res.status(403).json({ error: GDPR_DENIAL_MESSAGE });
      }
      
      let children;
      if (user.role === 'guardian') {
        // Guardians see only their own children
        children = await storage.getChildrenByGuardian(user.id);
      } else if (user.role === 'staff') {
        // Staff sees all children in their daycare
        if (!user.daycareId) return res.status(403).json({ error: 'Unauthorized' });
        children = await storage.getChildren(user.daycareId);
      } else if (user.role === 'daycareleader') {
        // Daycare leaders see all children in their daycare
        if (!user.daycareId) return res.status(403).json({ error: 'Unauthorized' });
        children = await storage.getChildren(user.daycareId);
      } else {
        return res.status(403).json({ error: 'Unauthorized' });
      }
      
      res.json(children);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch children' });
    }
  });

  app.post('/api/children', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const user = req.user!;
      
      // GDPR: Super admin cannot create children (personal data)
      if (user.role === 'super_admin') {
        await logAudit(user.id, user.role, null, 'ACCESS_DENIED', 'children');
        return res.status(403).json({ error: GDPR_DENIAL_MESSAGE });
      }
      
      // RBAC: Only admins can create children
      // Staff cannot create children as it would bypass group assignment system
      if (user.role !== 'daycareleader') {
        return res.status(403).json({ error: 'Only administrators can add children' });
      }
      
      if (!user.daycareId) return res.status(403).json({ error: 'Unauthorized' });
      
      const validatedData = insertChildSchema.parse({
        ...req.body,
        daycareId: user.daycareId,
      });
      const child = await storage.createChild(validatedData);
      
      await logAudit(user.id, user.role, user.daycareId, 'CREATE', 'child', child.id);
      res.json(child);
    } catch (error) {
      res.status(400).json({ error: 'Invalid request' });
    }
  });

  /**
   * Editing a child.
   *
   * Permission is split by field rather than by route. Name, birthdate and group
   * are administrative -- group especially, since setting it directly would bypass
   * the group assignment system -- so they stay with the daycare leader, matching
   * who may create and remove a child.
   *
   * Allergies and diet are different. A guardian mentions a new allergy to whoever
   * is at the door, and that is staff. Requiring the leader to record it means it
   * is recorded late or not at all, and this is the one field where late is unsafe.
   * So staff may write those two and nothing else.
   */
  const CARE_FIELDS = ['allergies', 'diet'] as const;

  app.patch('/api/children/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const user = req.user!;
      const childId = parseInt(req.params.id);
      if (Number.isNaN(childId)) return res.status(400).json({ error: 'Invalid request' });

      // GDPR: Super admin cannot touch personal data.
      if (user.role === 'super_admin') {
        await logAudit(user.id, user.role, null, 'ACCESS_DENIED', 'children');
        return res.status(403).json({ error: GDPR_DENIAL_MESSAGE });
      }

      if (user.role !== 'daycareleader' && user.role !== 'staff') {
        return res.status(403).json({ error: 'Unauthorized' });
      }
      if (!user.daycareId) return res.status(403).json({ error: 'Unauthorized' });

      const validatedData = updateChildSchema.parse(req.body);

      if (user.role === 'staff') {
        const administrative = Object.keys(validatedData).filter(
          (field) => !(CARE_FIELDS as readonly string[]).includes(field),
        );
        if (administrative.length > 0) {
          return res
            .status(403)
            .json({ error: 'Staff can only update allergies and diet' });
        }
      }

      const child = await storage.updateChild(childId, user.daycareId, validatedData);
      if (!child) return res.status(404).json({ error: 'Child not found' });

      await logAudit(user.id, user.role, user.daycareId, 'UPDATE', 'child', child.id);
      res.json(child);
    } catch (error) {
      res.status(400).json({ error: 'Invalid request' });
    }
  });

  app.get('/api/children/:id/entries', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const user = req.user!;
      const { id } = req.params;
      const childId = parseInt(id);
      
      // GDPR: Super admin cannot access personal data
      if (user.role === 'super_admin') {
        await logAudit(user.id, user.role, null, 'ACCESS_DENIED', 'entries');
        return res.status(403).json({ error: GDPR_DENIAL_MESSAGE });
      }
      
      const child = await storage.getChild(childId);
      
      if (!child) {
        return res.status(404).json({ error: 'Child not found' });
      }
      
      if (user.role === 'guardian') {
        // Guardians can only access their own children's entries
        const guardianChildren = await storage.getChildrenByGuardian(user.id);
        const hasAccess = guardianChildren.some(c => c.id === childId);
        
        if (!hasAccess) {
          return res.status(403).json({ error: 'Unauthorized' });
        }
      } else if (user.role === 'staff') {
        // RBAC: Staff can only access children in their assigned groups
        if (!user.daycareId) return res.status(403).json({ error: 'Unauthorized' });
        if (!canAccessDaycare(user, child.daycareId)) {
          return res.status(403).json({ error: 'Unauthorized' });
        }
        // Check if child is in staff's assigned groups
        const staffChildren = await storage.getChildrenByTeacherGroups(user.id);
        const hasAccess = staffChildren.some(c => c.id === childId);
        if (!hasAccess) {
          return res.status(403).json({ error: 'Unauthorized - child not in your assigned groups' });
        }
      } else if (user.role === 'daycareleader') {
        // Admins can access all children in their daycare
        if (!user.daycareId) return res.status(403).json({ error: 'Unauthorized' });
        if (!canAccessDaycare(user, child.daycareId)) {
          return res.status(403).json({ error: 'Unauthorized' });
        }
      } else {
        return res.status(403).json({ error: 'Unauthorized' });
      }
      
      const entries = await storage.getEntriesByChild(childId);
      res.json(entries);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch entries' });
    }
  });

  app.get('/api/entries', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const user = req.user!;
      
      // GDPR: Super admin cannot access personal data
      if (user.role === 'super_admin') {
        await logAudit(user.id, user.role, null, 'ACCESS_DENIED', 'entries');
        return res.status(403).json({ error: GDPR_DENIAL_MESSAGE });
      }
      
      if (user.role === 'guardian') {
        // Guardians see only entries for their children
        const children = await storage.getChildrenByGuardian(user.id);
        const allEntries = await Promise.all(
          children.map(child => storage.getEntriesByChild(child.id))
        );
        const entries = allEntries.flat();
        return res.json(entries);
      }
      
      const { limit, offset } = readPagination(req, LIST_LIMITS.entries);

      if (user.role === 'staff') {
        // Staff sees all entries in their daycare
        if (!user.daycareId) return res.status(403).json({ error: 'Unauthorized' });
        const entries = await storage.getEntries(user.daycareId, limit, offset);
        return res.json(entries);
      }
      
      if (user.role === 'daycareleader') {
        // Admins see all entries in their daycare
        if (!user.daycareId) return res.status(403).json({ error: 'Unauthorized' });
        const entries = await storage.getEntries(user.daycareId, limit, offset);
        return res.json(entries);
      }
      
      return res.status(403).json({ error: 'Unauthorized' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch entries' });
    }
  });

  app.post('/api/entries', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const user = req.user!;
      
      // GDPR: Super admin cannot create entries (personal data)
      if (user.role === 'super_admin') {
        await logAudit(user.id, user.role, null, 'ACCESS_DENIED', 'entries');
        return res.status(403).json({ error: GDPR_DENIAL_MESSAGE });
      }
      
      if (user.role !== 'daycareleader' && user.role !== 'staff') {
        return res.status(403).json({ error: 'Unauthorized' });
      }
      
      if (!user.daycareId) return res.status(403).json({ error: 'Unauthorized' });
      
      const { childId, type, value, note } = req.body;
      const parsedChildId = parseInt(childId);
      
      const child = await storage.getChild(parsedChildId);
      
      if (!child) {
        return res.status(404).json({ error: 'Child not found' });
      }
      
      if (!canAccessDaycare(user, child.daycareId)) {
        return res.status(403).json({ error: 'Unauthorized' });
      }
      
      // Staff can create entries for all children in their daycare
      // (Already verified that child belongs to their daycare via canAccessDaycare check above)
      
      const entry = await storage.createEntry({
        childId: parsedChildId,
        type,
        value,
        note: note || '',
        staffId: user.id,
      });
      
      // Create notifications for guardians
      const guardians = await storage.getGuardiansForChild(parsedChildId);
      
      await storage.createNotifications(
        guardians.map((guardian) => ({
          userId: guardian.id,
          daycareId: child.daycareId,
          type: 'entry',
          title: `entry_${type}`,
          message: JSON.stringify({ childName: child.name, entryType: type, value }),
          relatedId: entry.id,
        }))
      );

      // Also to their phones. Deliberately not awaited into the response: a
      // notification that cannot be delivered must not fail the entry that was
      // just saved, and sendPushToUsers never throws.
      void sendPushToUsers(guardians.map((g) => g.id), {
        title: child.name,
        body: value,
        data: { type: 'entry', entryId: String(entry.id), childId: String(child.id) },
      });
      
      await logAudit(user.id, user.role, user.daycareId, 'CREATE', 'entry', entry.id);
      res.json(entry);
    } catch (error) {
      res.status(400).json({ error: 'Invalid request' });
    }
  });

  app.get('/api/trips', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const user = req.user!;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // GDPR: Super admin cannot access personal data
      if (user.role === 'super_admin') {
        await logAudit(user.id, user.role, null, 'ACCESS_DENIED', 'trips');
        return res.status(403).json({ error: GDPR_DENIAL_MESSAGE });
      }
      
      const { limit: tripLimit, offset: tripOffset } = readPagination(req, LIST_LIMITS.trips);

      let trips;
      if (user.role === 'guardian') {
        const children = await storage.getChildrenByGuardian(user.id);
        if (children.length === 0) {
          return res.json([]);
        }
        
        if (!user.daycareId) return res.status(403).json({ error: 'Unauthorized' });
        trips = await storage.getTrips(user.daycareId, tripLimit, tripOffset);
      } else {
        if (!user.daycareId) return res.status(403).json({ error: 'Unauthorized' });
        trips = await storage.getTrips(user.daycareId, tripLimit, tripOffset);
      }
      
      // Filter to show only current and future trips
      const filteredTrips = trips.filter(trip => {
        const tripDate = new Date(trip.date);
        tripDate.setHours(0, 0, 0, 0);
        return tripDate >= today;
      });
      
      res.json(filteredTrips);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch trips' });
    }
  });

  app.post('/api/trips', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const user = req.user!;
      
      // GDPR: Super admin cannot create trips (personal data)
      if (user.role === 'super_admin') {
        await logAudit(user.id, user.role, null, 'ACCESS_DENIED', 'trips');
        return res.status(403).json({ error: GDPR_DENIAL_MESSAGE });
      }
      
      if (user.role !== 'daycareleader' && user.role !== 'staff') {
        return res.status(403).json({ error: 'Unauthorized' });
      }
      
      if (!user.daycareId) return res.status(403).json({ error: 'Unauthorized' });
      
      const validatedData = insertTripSchema.parse({
        ...req.body,
        createdBy: user.id,
        daycareId: user.daycareId,
      });
      
      const trip = await storage.createTrip(validatedData);
      
      // Notify every guardian in the daycare. This used to fetch the guardians of
      // each child in turn and then insert one notification at a time, so a daycare
      // with 100 children and 150 guardians cost roughly 250 sequential round trips
      // to create a single trip. It is now three queries plus one bulk insert.
      const allChildren = await storage.getChildren(validatedData.daycareId);
      const tripGuardians = await storage.getGuardiansForChildren(allChildren.map((c) => c.id));
      const guardianIds = tripGuardians.map((g) => g.id);
      
      await storage.createNotifications(guardianIds.map((guardianId) => ({
        userId: guardianId,
        daycareId: validatedData.daycareId,
        type: 'trip',
        title: 'new_trip',
        message: JSON.stringify({ tripTitle: trip.title, tripDate: trip.date, tripLocation: trip.location }),
        relatedId: trip.id,
      })));

      void sendPushToUsers(guardianIds, {
        title: trip.title,
        body: `${trip.date} · ${trip.location}`,
        data: { type: 'trip', tripId: String(trip.id) },
      });
      
      await logAudit(user.id, user.role, user.daycareId, 'CREATE', 'trip', trip.id);
      res.json(trip);
    } catch (error) {
      res.status(400).json({ error: 'Invalid request' });
    }
  });

  app.post('/api/trips/:id/respond', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const user = req.user!;
      const { id } = req.params;
      const tripId = parseInt(id);
      
      if (user.role !== 'guardian') {
        return res.status(403).json({ error: 'Unauthorized' });
      }
      
      if (!user.daycareId) return res.status(403).json({ error: 'Unauthorized' });
      
      const trip = await storage.getTrip(tripId);
      
      if (!trip) {
        return res.status(404).json({ error: 'Trip not found' });
      }
      
      if (!canAccessDaycare(user, trip.daycareId)) {
        return res.status(403).json({ error: 'Unauthorized' });
      }
      
      const { childId, response: responseValue } = req.body;
      const parsedChildId = parseInt(childId);
      
      const children = await storage.getChildrenByGuardian(user.id);
      const childIds = children.map(c => c.id);
      
      if (!childIds.includes(parsedChildId)) {
        return res.status(403).json({ error: 'Not authorized for this child' });
      }
      
      const response = await storage.createTripResponse({
        tripId,
        guardianId: user.id,
        childId: parsedChildId,
        response: responseValue,
      });
      
      await logAudit(user.id, user.role, user.daycareId, 'CREATE', 'trip_response', response.id);
      
      res.json(response);
    } catch (error) {
      res.status(400).json({ error: 'Invalid request' });
    }
  });

  app.get('/api/trip-responses', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const user = req.user!;
      
      // GDPR: Super admin cannot access personal data
      if (user.role === 'super_admin') {
        await logAudit(user.id, user.role, null, 'ACCESS_DENIED', 'trip_responses');
        return res.status(403).json({ error: GDPR_DENIAL_MESSAGE });
      }
      
      if (user.role === 'guardian') {
        const responses = await storage.getTripResponsesByGuardian(user.id);
        return res.json(responses);
      }
      
      if (!user.daycareId) return res.status(403).json({ error: 'Unauthorized' });
      const responses = await storage.getTripResponses(user.daycareId);
      res.json(responses);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch responses' });
    }
  });

  app.get('/api/users', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const user = req.user!;
      
      // GDPR: Super admin cannot access user lists (personal data)
      if (user.role === 'super_admin') {
        await logAudit(user.id, user.role, null, 'ACCESS_DENIED', 'users');
        return res.status(403).json({ error: GDPR_DENIAL_MESSAGE });
      }
      
      if (!['daycareleader', 'staff', 'guardian'].includes(user.role)) {
        return res.status(403).json({ error: 'Unauthorized' });
      }
      
      if (!user.daycareId) return res.status(403).json({ error: 'Unauthorized' });
      
      const daycareUsers = await storage.getUsersByDaycare(user.daycareId);

      // A guardian needs this list to pick who to message, but must not learn which
      // other families attend the daycare. They see the staff and leaders of their
      // own daycare and nothing else -- no other guardians, and no child links.
      if (user.role === 'guardian') {
        const contacts = daycareUsers
          .filter((u) => u.role === 'staff' || u.role === 'daycareleader')
          .map((u) => ({
            id: u.id,
            name: u.name,
            role: u.role,
            daycareId: u.daycareId,
            linkedChildren: [] as { id: number; name: string }[],
          }));
        return res.json(contacts);
      }

      // Staff and leaders see the full roster. The child links are fetched in one
      // query for all guardians rather than one query per guardian.
      const childrenByGuardian = await storage.getChildrenByGuardians(
        daycareUsers.filter((u) => u.role === 'guardian').map((u) => u.id)
      );

      const usersWithChildren = daycareUsers.map((u) => {
        const linkedChildren = (childrenByGuardian.get(u.id) ?? [])
          .filter((c) => c.daycareId === user.daycareId);
        return {
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role,
          daycareId: u.daycareId,
          linkedChildren: linkedChildren.map((c) => ({ id: c.id, name: c.name })),
        };
      });
      
      res.json(usersWithChildren);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch users' });
    }
  });

  app.post('/api/users', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const user = req.user!;
      
      if (user.role !== 'daycareleader' && user.role !== 'staff') {
        return res.status(403).json({ error: 'Unauthorized' });
      }
      
      if (!user.daycareId) return res.status(403).json({ error: 'Unauthorized' });
      
      const validatedData = createUserSchema.parse({
        ...req.body,
        daycareId: user.daycareId,
      });

      // Creating accounts and choosing their role are separate permissions: staff
      // add guardians, but must not be able to mint themselves a daycare leader.
      if (!canCreateRole(user, validatedData.role)) {
        await logAudit(user.id, user.role, user.daycareId, 'ACCESS_DENIED', 'user', undefined, {
          attemptedRole: validatedData.role,
        });
        return res.status(403).json({ error: 'You cannot create an account with that role' });
      }

      const existingUser = await storage.getUserByEmail(validatedData.email);
      if (existingUser) {
        return res.status(400).json({ error: 'Email already in use' });
      }
      
      const passwordHash = await hashPassword(validatedData.password);
      
      const newUser = await storage.createUser({
        name: validatedData.name,
        email: validatedData.email,
        passwordHash,
        role: validatedData.role,
        daycareId: validatedData.daycareId,
      });
      
      await logAudit(user.id, user.role, user.daycareId, 'CREATE', 'user', newUser.id, { role: validatedData.role });
      
      res.json({
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        daycareId: newUser.daycareId,
      });
    } catch (error) {
      res.status(400).json({ error: 'Invalid request' });
    }
  });

  app.post('/api/users/:userId/children/:childId', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const user = req.user!;
      const { userId, childId } = req.params;
      
      // GDPR: Super admin cannot link guardians to children (personal data operation)
      if (user.role === 'super_admin') {
        await logAudit(user.id, user.role, null, 'ACCESS_DENIED', 'guardian_child_link');
        return res.status(403).json({ error: GDPR_DENIAL_MESSAGE });
      }
      
      if (user.role !== 'daycareleader' && user.role !== 'staff') {
        return res.status(403).json({ error: 'Unauthorized' });
      }
      
      if (!user.daycareId) return res.status(403).json({ error: 'Unauthorized' });
      
      const targetUser = await storage.getUser(parseInt(userId));
      const child = await storage.getChild(parseInt(childId));
      
      if (!targetUser || !child) {
        return res.status(404).json({ error: 'User or child not found' });
      }
      
      // Verify both user and child are in same daycare as requester
      if (!canAccessDaycare(user, targetUser.daycareId!) || !canAccessDaycare(user, child.daycareId)) {
        return res.status(403).json({ error: 'Unauthorized' });
      }
      
      // Verify they are in the same daycare as each other
      if (targetUser.daycareId !== child.daycareId) {
        return res.status(403).json({ error: 'User and child must be from same daycare' });
      }
      
      if (targetUser.role !== 'guardian') {
        return res.status(400).json({ error: 'Can only link guardians to children' });
      }
      
      await storage.createGuardianRelation(parseInt(userId), parseInt(childId));
      
      await logAudit(user.id, user.role, user.daycareId, 'CREATE', 'guardian_child_link');
      
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: 'Invalid request' });
    }
  });

  app.delete('/api/users/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const user = req.user!;
      const { id } = req.params;
      const userId = parseInt(id);

      // GDPR: Super admin cannot delete users (personal data operation)
      if (user.role === 'super_admin') {
        await logAudit(user.id, user.role, null, 'ACCESS_DENIED', 'users');
        return res.status(403).json({ error: GDPR_DENIAL_MESSAGE });
      }

      if (user.role !== 'daycareleader') {
        return res.status(403).json({ error: 'Unauthorized' });
      }

      if (!user.daycareId) return res.status(403).json({ error: 'Unauthorized' });

      const targetUser = await storage.getUser(userId);
      if (!targetUser) {
        return res.status(404).json({ error: 'User not found' });
      }

      if (!canAccessDaycare(user, targetUser.daycareId!)) {
        return res.status(403).json({ error: 'Unauthorized' });
      }

      await storage.deleteUser(userId);
      await logAudit(user.id, user.role, user.daycareId, 'DELETE', 'user', userId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete user' });
    }
  });

  app.delete('/api/children/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const user = req.user!;
      const { id } = req.params;
      const childId = parseInt(id);

      // GDPR: Super admin cannot delete children (personal data operation)
      if (user.role === 'super_admin') {
        await logAudit(user.id, user.role, null, 'ACCESS_DENIED', 'children');
        return res.status(403).json({ error: GDPR_DENIAL_MESSAGE });
      }

      // RBAC: Only admins can delete children
      // Staff cannot delete children - this is an administrative operation
      if (user.role !== 'daycareleader') {
        return res.status(403).json({ error: 'Only administrators can remove children' });
      }

      if (!user.daycareId) return res.status(403).json({ error: 'Unauthorized' });

      const child = await storage.getChild(childId);
      if (!child) {
        return res.status(404).json({ error: 'Child not found' });
      }

      if (!canAccessDaycare(user, child.daycareId)) {
        return res.status(403).json({ error: 'Unauthorized' });
      }

      await storage.deleteChild(childId);
      await logAudit(user.id, user.role, user.daycareId, 'DELETE', 'child', childId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete child' });
    }
  });

  app.delete('/api/trips/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const user = req.user!;
      const { id } = req.params;
      const tripId = parseInt(id);

      // GDPR: Super admin cannot delete trips (personal data operation)
      if (user.role === 'super_admin') {
        await logAudit(user.id, user.role, null, 'ACCESS_DENIED', 'trips');
        return res.status(403).json({ error: GDPR_DENIAL_MESSAGE });
      }

      if (user.role !== 'daycareleader' && user.role !== 'staff') {
        return res.status(403).json({ error: 'Unauthorized' });
      }

      if (!user.daycareId) return res.status(403).json({ error: 'Unauthorized' });

      const trip = await storage.getTrip(tripId);
      if (!trip) {
        return res.status(404).json({ error: 'Trip not found' });
      }

      if (!canAccessDaycare(user, trip.daycareId)) {
        return res.status(403).json({ error: 'Unauthorized' });
      }

      await storage.deleteTrip(tripId);
      await logAudit(user.id, user.role, user.daycareId, 'DELETE', 'trip', tripId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete trip' });
    }
  });

  app.delete('/api/documents/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const user = req.user!;
      const { id } = req.params;
      const docId = parseInt(id);

      // GDPR: Super admin cannot delete documents (personal data operation)
      if (user.role === 'super_admin') {
        await logAudit(user.id, user.role, null, 'ACCESS_DENIED', 'documents');
        return res.status(403).json({ error: GDPR_DENIAL_MESSAGE });
      }

      if (user.role !== 'daycareleader' && user.role !== 'staff') {
        return res.status(403).json({ error: 'Unauthorized' });
      }

      if (!user.daycareId) return res.status(403).json({ error: 'Unauthorized' });

      const docs = await storage.getDocuments(user.daycareId);
      const document = docs.find(d => d.id === docId);
      
      if (!document) {
        return res.status(404).json({ error: 'Document not found' });
      }

      await storage.deleteDocument(docId);
      await logAudit(user.id, user.role, user.daycareId, 'DELETE', 'document', docId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete document' });
    }
  });

  // ==========================================
  // Municipality Management (Super Admin only)
  // ==========================================
  
  app.get('/api/municipalities', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const user = req.user!;
      
      if (user.role !== 'super_admin') {
        return res.status(403).json({ error: 'Unauthorized' });
      }
      
      const allMunicipalities = await storage.getAllMunicipalities();
      res.json(allMunicipalities);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch municipalities' });
    }
  });
  
  app.get('/api/municipalities/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const user = req.user!;
      const { id } = req.params;
      
      if (user.role !== 'super_admin') {
        return res.status(403).json({ error: 'Unauthorized' });
      }
      
      const municipality = await storage.getMunicipality(parseInt(id));
      if (!municipality) {
        return res.status(404).json({ error: 'Municipality not found' });
      }
      
      res.json(municipality);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch municipality' });
    }
  });
  
  app.post('/api/municipalities', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const user = req.user!;
      
      if (user.role !== 'super_admin') {
        return res.status(403).json({ error: 'Unauthorized' });
      }
      
      const validatedData = insertMunicipalitySchema.parse(req.body);
      
      // Check for duplicate code or name
      const existingByCode = await storage.getMunicipalityByCode(validatedData.code);
      if (existingByCode) {
        return res.status(400).json({ error: 'Municipality code already in use' });
      }
      
      const municipality = await storage.createMunicipality(validatedData);
      
      await logAudit(user.id, user.role, null, 'CREATE', 'municipality', municipality.id);
      
      res.json(municipality);
    } catch (error) {
      res.status(400).json({ error: 'Invalid request' });
    }
  });
  
  app.patch('/api/municipalities/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const user = req.user!;
      const { id } = req.params;
      
      if (user.role !== 'super_admin') {
        return res.status(403).json({ error: 'Unauthorized' });
      }
      
      const municipality = await storage.getMunicipality(parseInt(id));
      if (!municipality) {
        return res.status(404).json({ error: 'Municipality not found' });
      }
      
      // Pre-validation: reject empty request body
      if (!req.body || Object.keys(req.body).length === 0) {
        return res.status(400).json({ error: 'No update fields provided' });
      }
      
      // Validate and normalize updates using dedicated update schema
      // Schema handles: trimming, uppercasing codes, email lowercase, strict mode
      // Schema converts empty strings to null for clearable fields (defaultMenuSourceUrl, contactEmail)
      const validatedUpdates = updateMunicipalitySchema.parse(req.body);
      
      // Build updates object - keep null values for clearing, skip undefined
      const cleanUpdates: Record<string, any> = {};
      for (const [key, value] of Object.entries(validatedUpdates)) {
        if (value !== undefined) {
          cleanUpdates[key] = value;
        }
      }
      
      // Reject if no actual updates after filtering undefined
      if (Object.keys(cleanUpdates).length === 0) {
        return res.status(400).json({ error: 'No valid updates provided' });
      }
      
      // Check for code uniqueness if code is being changed (already normalized/uppercased by schema)
      if (cleanUpdates.code && cleanUpdates.code !== municipality.code) {
        const existingByCode = await storage.getMunicipalityByCode(cleanUpdates.code as string);
        if (existingByCode) {
          return res.status(400).json({ error: 'Municipality code already in use' });
        }
      }
      
      const updatedMunicipality = await storage.updateMunicipality(parseInt(id), cleanUpdates);
      
      await logAudit(user.id, user.role, null, 'UPDATE', 'municipality', parseInt(id));
      
      res.json(updatedMunicipality);
    } catch (error) {
      res.status(400).json({ error: 'Invalid request' });
    }
  });
  
  app.delete('/api/municipalities/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const user = req.user!;
      const { id } = req.params;
      
      if (user.role !== 'super_admin') {
        return res.status(403).json({ error: 'Unauthorized' });
      }
      
      const municipality = await storage.getMunicipality(parseInt(id));
      if (!municipality) {
        return res.status(404).json({ error: 'Municipality not found' });
      }
      
      await storage.deleteMunicipality(parseInt(id));
      
      await logAudit(user.id, user.role, null, 'DELETE', 'municipality', parseInt(id));
      
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete municipality' });
    }
  });
  
  // Get daycares by municipality ID
  app.get('/api/municipalities/:id/daycares', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const user = req.user!;
      const { id } = req.params;
      
      if (user.role !== 'super_admin') {
        return res.status(403).json({ error: 'Unauthorized' });
      }
      
      const municipalityDaycares = await storage.getDaycaresByMunicipalityId(parseInt(id));
      res.json(municipalityDaycares);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch daycares' });
    }
  });

  // ==========================================
  // Daycare Management (Super Admin only)
  // ==========================================

  app.delete('/api/daycares/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const user = req.user!;
      const { id } = req.params;
      const daycareId = parseInt(id);

      if (user.role !== 'super_admin') {
        return res.status(403).json({ error: 'Unauthorized' });
      }

      const daycare = await storage.getDaycare(daycareId);
      if (!daycare) {
        return res.status(404).json({ error: 'Daycare not found' });
      }

      await storage.deleteDaycare(daycareId);
      
      await logAudit(user.id, user.role, null, 'DELETE', 'daycare', daycareId);
      
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete daycare' });
    }
  });

  app.get('/api/daycares', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const user = req.user!;
      
      if (user.role !== 'super_admin') {
        return res.status(403).json({ error: 'Unauthorized' });
      }
      
      const daycares = await storage.getAllDaycares();
      res.json(daycares);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch daycares' });
    }
  });

  app.post('/api/daycares', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const user = req.user!;
      
      if (user.role !== 'super_admin') {
        return res.status(403).json({ error: 'Unauthorized' });
      }
      
      const validatedData = insertDaycareSchema.parse(req.body);
      
      const existingDaycare = await storage.getDaycareByCode(validatedData.code);
      if (existingDaycare) {
        return res.status(400).json({ error: 'Daycare code already in use' });
      }
      
      const daycare = await storage.createDaycare(validatedData);
      
      // Create default meal menus for the next 7 days
      const today = new Date();
      const mealTypes: ('breakfast' | 'lunch' | 'snack')[] = ['breakfast', 'lunch', 'snack'];
      
      for (let i = 0; i < 7; i++) {
        const menuDate = new Date(today);
        menuDate.setDate(today.getDate() + i);
        const dateStr = menuDate.toISOString().split('T')[0];
        
        for (const mealType of mealTypes) {
          try {
            await storage.createMealMenu({
              daycareId: daycare.id,
              date: dateStr,
              mealType: mealType,
              foodName: '',
            });
          } catch (e) {
            // Ignore duplicate errors
          }
        }
      }
      
      await logAudit(user.id, user.role, null, 'CREATE', 'daycare', daycare.id);
      
      // Invalidate public cache
      invalidateCache('public:');
      
      res.json(daycare);
    } catch (error) {
      res.status(400).json({ error: 'Invalid request' });
    }
  });

  // GDPR: Super admin can ONLY see admin users per daycare, not all users
  app.get('/api/super-admin/admins', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const user = req.user!;
      
      if (user.role !== 'super_admin') {
        return res.status(403).json({ error: 'Unauthorized' });
      }
      
      const daycares = await storage.getAllDaycares();
      const adminsByDaycare = await Promise.all(
        daycares.map(async (daycare) => {
          const admins = await storage.getDaycareLeadersByDaycare(daycare.id);
          return {
            daycareId: daycare.id,
            daycareName: daycare.name,
            admins: admins.map((a: typeof admins[number]) => ({
              id: a.id,
              name: a.name,
              email: a.email,
            })),
          };
        })
      );
      
      await logAudit(user.id, user.role, null, 'VIEW', 'admins_list');
      res.json(adminsByDaycare);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch admins' });
    }
  });

  // GDPR: Super admin can ONLY create admin users for daycares
  app.post('/api/super-admin/admins', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const user = req.user!;
      
      if (user.role !== 'super_admin') {
        return res.status(403).json({ error: 'Unauthorized' });
      }
      
      const { name, email, password, daycareId } = req.body;
      
      if (!name || !email || !password || !daycareId) {
        return res.status(400).json({ error: 'All fields required' });
      }
      
      // Verify daycare exists
      const daycare = await storage.getDaycare(daycareId);
      if (!daycare) {
        return res.status(404).json({ error: 'Daycare not found' });
      }
      
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ error: 'Email already in use' });
      }
      
      const passwordHash = await hashPassword(password);
      
      // Super admin can ONLY create daycare leader users
      const newUser = await storage.createUser({
        name,
        email,
        passwordHash,
        role: 'daycareleader',
        daycareId,
        passwordNeedsReset: false,
      });
      
      await logAudit(user.id, user.role, daycareId, 'CREATE', 'daycareleader', newUser.id);
      res.json({
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        daycareId: newUser.daycareId,
      });
    } catch (error) {
      res.status(400).json({ error: 'Invalid request' });
    }
  });

  // Delete daycare leader (admin) - Super admin only
  app.delete('/api/super-admin/admins/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const user = req.user!;
      
      if (user.role !== 'super_admin') {
        return res.status(403).json({ error: 'Unauthorized' });
      }
      
      const { id } = req.params;
      const adminId = parseInt(id);
      
      const targetUser = await storage.getUser(adminId);
      if (!targetUser) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      // Verify target user is a daycare leader
      if (targetUser.role !== 'daycareleader') {
        return res.status(400).json({ error: 'Can only delete daycare leaders' });
      }
      
      // Delete the user (this cascades to all related data)
      await storage.deleteUser(adminId);
      await logAudit(user.id, user.role, targetUser.daycareId, 'DELETE', 'daycareleader', adminId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete admin' });
    }
  });
  
  // Super admin stats endpoint (anonymized aggregated data only)
  app.get('/api/super-admin/stats', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const user = req.user!;
      
      if (user.role !== 'super_admin') {
        return res.status(403).json({ error: 'Unauthorized' });
      }
      
      const stats = await storage.getAnonymizedStats();
      await logAudit(user.id, user.role, null, 'VIEW', 'stats');
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch stats' });
    }
  });
  
  // Daycare admin KPI stats endpoint (daycare leaders only)
  app.get('/api/daycare/stats', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const user = req.user!;
      
      if (!user.daycareId || user.role !== 'daycareleader') {
        return res.status(403).json({ error: 'Unauthorized' });
      }
      
      const stats = await storage.getDaycareStats(user.daycareId);
      await logAudit(user.id, user.role, user.daycareId, 'VIEW', 'daycare_stats');
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch daycare stats' });
    }
  });
  
  // CSV Export endpoints (daycare leaders only)
  app.get('/api/export/children', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const user = req.user!;
      
      if (!user.daycareId || user.role !== 'daycareleader') {
        return res.status(403).json({ error: 'Unauthorized' });
      }
      
      const children = await storage.getChildren(user.daycareId);
      
      const headers = ['ID', 'Nimi', 'Syntymäaika', 'Ryhmä', 'Allergiat', 'Ruokavalio'];
      const rows = await Promise.all(children.map(async (child) => {
        const group = child.groupId ? await storage.getGroupById(child.groupId) : null;
        return [
          child.id,
          child.name,
          child.birthdate ? new Date(child.birthdate).toLocaleDateString('fi-FI') : '',
          group?.name || '',
          child.allergies || '',
          child.diet || ''
        ];
      }));
      
      const csv = csvFile(headers, rows);
      
      await logAudit(user.id, user.role, user.daycareId, 'VIEW', 'export_children');
      
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', attachment(`lapset-${new Date().toISOString().split('T')[0]}.csv`));
      res.send(csv);
    } catch (error) {
      console.error('Error exporting children:', error);
      res.status(500).json({ error: 'Failed to export children' });
    }
  });
  
  app.get('/api/export/entries', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const user = req.user!;
      
      if (!user.daycareId || user.role !== 'daycareleader') {
        return res.status(403).json({ error: 'Unauthorized' });
      }
      
      const { startDate, endDate } = req.query;
      const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const end = endDate ? new Date(endDate as string) : new Date();
      
      const entries = await storage.getEntriesByDateRange(user.daycareId, start, end);
      const children = await storage.getChildren(user.daycareId);
      const childMap = new Map(children.map(c => [c.id, c]));
      
      // Bulk fetch all staff to avoid N+1 queries
      const staffIds = Array.from(new Set(entries.map(e => e.staffId).filter(Boolean))) as number[];
      const staff = await storage.getUsersByIds(staffIds);
      const staffMap = new Map(staff.map(s => [s.id, s]));
      
      const headers = ['Päivämäärä', 'Aika', 'Lapsi', 'Tyyppi', 'Sisältö', 'Merkinnyt'];
      const rows = entries.map((entry) => {
        const child = childMap.get(entry.childId);
        const entryStaff = staffMap.get(entry.staffId);
        const timestamp = new Date(entry.timestamp);
        return [
          timestamp.toLocaleDateString('fi-FI'),
          timestamp.toLocaleTimeString('fi-FI'),
          child?.name || '',
          entry.type,
          entry.value || '',
          entryStaff?.name || ''
        ];
      });
      
      const csv = csvFile(headers, rows);
      
      await logAudit(user.id, user.role, user.daycareId, 'VIEW', 'export_entries');
      
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', attachment(`merkinnät-${start.toISOString().split('T')[0]}-${end.toISOString().split('T')[0]}.csv`));
      res.send(csv);
    } catch (error) {
      console.error('Error exporting entries:', error);
      res.status(500).json({ error: 'Failed to export entries' });
    }
  });
  
  app.get('/api/export/absences', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const user = req.user!;
      
      if (!user.daycareId || user.role !== 'daycareleader') {
        return res.status(403).json({ error: 'Unauthorized' });
      }
      
      const { startDate, endDate } = req.query;
      const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const end = endDate ? new Date(endDate as string) : new Date();
      
      const absences = await storage.getAbsencesByDateRange(user.daycareId, start, end);
      const children = await storage.getChildren(user.daycareId);
      const childMap = new Map(children.map(c => [c.id, c]));
      
      // Bulk fetch all reporters to avoid N+1 queries
      const reporterIds = Array.from(new Set(absences.map(a => a.reportedById).filter(Boolean))) as number[];
      const reporters = await storage.getUsersByIds(reporterIds);
      const reporterMap = new Map(reporters.map(r => [r.id, r]));
      
      const headers = ['Päivämäärä', 'Lapsi', 'Tyyppi', 'Syy', 'Ilmoittaja'];
      const rows = absences.map((absence) => {
        const child = childMap.get(absence.childId);
        const reporter = reporterMap.get(absence.reportedById);
        return [
          new Date(absence.date).toLocaleDateString('fi-FI'),
          child?.name || '',
          absence.type || '',
          absence.reason || '',
          reporter?.name || ''
        ];
      });
      
      const csv = csvFile(headers, rows);
      
      await logAudit(user.id, user.role, user.daycareId, 'VIEW', 'export_absences');
      
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', attachment(`poissaolot-${start.toISOString().split('T')[0]}-${end.toISOString().split('T')[0]}.csv`));
      res.send(csv);
    } catch (error) {
      console.error('Error exporting absences:', error);
      res.status(500).json({ error: 'Failed to export absences' });
    }
  });
  
  app.get('/api/export/attendance', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const user = req.user!;
      
      if (!user.daycareId || user.role !== 'daycareleader') {
        return res.status(403).json({ error: 'Unauthorized' });
      }
      
      const { startDate, endDate } = req.query;
      const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const end = endDate ? new Date(endDate as string) : new Date();
      
      const children = await storage.getChildren(user.daycareId);
      const entries = await storage.getEntriesByDateRange(user.daycareId, start, end);
      const absences = await storage.getAbsencesByDateRange(user.daycareId, start, end);
      
      // Build attendance summary per child
      const attendanceSummary = children.map(child => {
        const childEntries = entries.filter(e => e.childId === child.id);
        const childAbsences = absences.filter(a => a.childId === child.id);
        const arrivalDays = new Set(childEntries.filter(e => e.type === 'arrival').map(e => new Date(e.timestamp).toLocaleDateString('fi-FI'))).size;
        // Each absence is a single day (uses date field, not startDate/endDate)
        const absenceDays = new Set(childAbsences.map(a => new Date(a.date).toLocaleDateString('fi-FI'))).size;
        
        return {
          name: child.name,
          arrivalDays,
          absenceDays,
          totalEntries: childEntries.length
        };
      });
      
      const headers = ['Lapsi', 'Läsnäolopäiviä', 'Poissaolopäiviä', 'Merkintöjä yhteensä'];
      const rows = attendanceSummary.map(summary => [
        summary.name,
        summary.arrivalDays,
        summary.absenceDays,
        summary.totalEntries
      ]);
      
      const csv = csvFile(headers, rows);
      
      await logAudit(user.id, user.role, user.daycareId, 'VIEW', 'export_attendance');
      
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', attachment(`läsnäolo-${start.toISOString().split('T')[0]}-${end.toISOString().split('T')[0]}.csv`));
      res.send(csv);
    } catch (error) {
      console.error('Error exporting attendance:', error);
      res.status(500).json({ error: 'Failed to export attendance' });
    }
  });
  
  // Super admin audit logs endpoint (GDPR: metadata sanitized to prevent PII exposure)
  app.get('/api/super-admin/audit-logs', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const user = req.user!;
      
      if (user.role !== 'super_admin') {
        return res.status(403).json({ error: 'Unauthorized' });
      }
      
      const { daycareId, limit, offset } = req.query;
      const logs = await storage.getAuditLogs(
        daycareId ? parseInt(daycareId as string) : undefined,
        limit ? parseInt(limit as string) : 100,
        offset ? parseInt(offset as string) : 0
      );
      
      // GDPR: Sanitize logs - remove metadata that might contain PII (IP addresses, etc.)
      // Only return safe fields: id, action, entityType, entityIdHash, actorRole, daycareId, timestamp
      // Field is explicitly named 'entityIdHash' to prevent accidental reintroduction of raw IDs
      const sanitizedLogs = logs.map(log => ({
        id: log.id,
        action: log.action,
        entityType: log.entityType,
        entityIdHash: log.entityIdHash, // Explicitly named to indicate hashing
        userRole: log.actorRole, // Renamed for API response clarity
        daycareId: log.daycareId,
        createdAt: log.timestamp, // Renamed for API response clarity
        // metadata: explicitly excluded - may contain IP addresses or other PII
      }));
      
      res.json(sanitizedLogs);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch audit logs' });
    }
  });

  app.get('/api/absences', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const user = req.user!;
      
      // GDPR: Super admin cannot access absences (personal data)
      if (user.role === 'super_admin') {
        await logAudit(user.id, user.role, null, 'ACCESS_DENIED', 'absences');
        return res.status(403).json({ error: GDPR_DENIAL_MESSAGE });
      }
      
      if (!user.daycareId) return res.status(403).json({ error: 'Unauthorized' });
      
      const { limit: absenceLimit, offset: absenceOffset } = readPagination(req, LIST_LIMITS.absences);

      let absences;
      if (user.role === 'guardian') {
        // Guardians see only absences for their children
        const children = await storage.getChildrenByGuardian(user.id);
        const allAbsences = await Promise.all(
          children.map(child => storage.getAbsencesByChild(child.id))
        );
        absences = allAbsences.flat();
      } else if (user.role === 'staff') {
        // RBAC: Staff sees ONLY absences for children in their assigned groups
        const children = await storage.getChildrenByTeacherGroups(user.id);
        const allAbsences = await Promise.all(
          children.map(child => storage.getAbsencesByChild(child.id))
        );
        absences = allAbsences.flat();
      } else if (user.role === 'daycareleader') {
        // Admins see all absences in their daycare
        absences = await storage.getAbsences(user.daycareId, absenceLimit, absenceOffset);
      } else {
        return res.status(403).json({ error: 'Unauthorized' });
      }
      
      const enrichedAbsences = await Promise.all(
        absences.map(async (absence) => {
          const child = await storage.getChild(absence.childId);
          const reporter = await storage.getUser(absence.reportedById);
          
          return {
            ...absence,
            childName: child?.name || 'Unknown',
            reportedByName: reporter?.name || 'Unknown',
          };
        })
      );
      
      res.json(enrichedAbsences);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch absences' });
    }
  });

  app.post('/api/absences', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const user = req.user!;
      
      // GDPR: Super admin cannot create absences (personal data)
      if (user.role === 'super_admin') {
        await logAudit(user.id, user.role, null, 'ACCESS_DENIED', 'absences');
        return res.status(403).json({ error: GDPR_DENIAL_MESSAGE });
      }
      
      // Only guardians can report absences
      if (user.role !== 'guardian') {
        return res.status(403).json({ error: 'Only parents can report absences' });
      }
      
      if (!user.daycareId) return res.status(403).json({ error: 'Unauthorized' });
      
      const validatedData = insertAbsenceSchema.parse({
        ...req.body,
        reportedById: user.id,
        daycareId: user.daycareId,
      });
      
      const child = await storage.getChild(validatedData.childId);
      if (!child || child.daycareId !== validatedData.daycareId) {
        return res.status(403).json({ error: 'Unauthorized' });
      }
      
      // Verify guardian is linked to this child
      const guardianChildren = await storage.getChildrenByGuardian(user.id);
      const isGuardianOfChild = guardianChildren.some(c => c.id === validatedData.childId);
      if (!isGuardianOfChild) {
        return res.status(403).json({ error: 'Unauthorized' });
      }
      
      // The very same report arriving twice is a duplicate, not a second event.
      //
      // It used to add another row and notify the staff again, so one child away
      // read as several -- easy to cause from a phone, where a tap may not look
      // like it registered. Only an exact repeat is treated this way: a child can
      // arrive late and also be collected early on one day, and those are two
      // real reports that both have to survive.
      const reportedToday = await storage.getAbsencesForChildOnDate(
        validatedData.childId,
        validatedData.date,
      );
      const identical = reportedToday.find(
        (a) => a.type === validatedData.type && (a.reason ?? '') === (validatedData.reason ?? ''),
      );
      if (identical) return res.json(identical);

      const absence = await storage.createAbsence(validatedData);

      // Create notifications for staff/admin when absence is reported
      const staff = await storage.getStaffByDaycare(validatedData.daycareId);
      
      await storage.createNotifications(
        staff.map((staffMember) => ({
          userId: staffMember.id,
          daycareId: validatedData.daycareId,
          type: 'absence',
          title: `absence_${validatedData.type}`,
          message: JSON.stringify({ childName: child.name, absenceType: validatedData.type, date: validatedData.date }),
          relatedId: absence.id,
        }))
      );

      void sendPushToUsers(staff.map((s) => s.id), {
        title: child.name,
        body: `${validatedData.type} · ${validatedData.date}`,
        data: { type: 'absence', absenceId: String(absence.id) },
      });
      
      await logAudit(user.id, user.role, user.daycareId, 'CREATE', 'absence', absence.id);
      res.json(absence);
    } catch (error) {
      res.status(400).json({ error: 'Invalid request' });
    }
  });

  app.get('/api/messages', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const user = req.user!;
      
      // GDPR: Super admin cannot access messages (personal data)
      if (user.role === 'super_admin') {
        await logAudit(user.id, user.role, null, 'ACCESS_DENIED', 'messages');
        return res.status(403).json({ error: GDPR_DENIAL_MESSAGE });
      }
      
      if (!user.daycareId) return res.status(403).json({ error: 'Unauthorized' });
      const { limit: msgLimit, offset: msgOffset } = readPagination(req, LIST_LIMITS.messages);
      const messages = await storage.getMessages(user.id, user.daycareId, msgLimit, msgOffset);
      
      const enrichedMessages = await Promise.all(
        messages.map(async (msg) => {
          const sender = await storage.getUser(msg.senderId);
          const recipient = await storage.getUser(msg.recipientId);
          const child = msg.childId ? await storage.getChild(msg.childId) : null;
          
          return {
            ...msg,
            senderName: sender?.name || 'Unknown',
            recipientName: recipient?.name || 'Unknown',
            childName: child?.name || null,
          };
        })
      );
      
      res.json(enrichedMessages);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch messages' });
    }
  });

  app.get('/api/conversations/:otherUserId', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const user = req.user!;
      const { otherUserId } = req.params;
      
      // GDPR: Super admin cannot access conversations (personal data)
      if (user.role === 'super_admin') {
        await logAudit(user.id, user.role, null, 'ACCESS_DENIED', 'messages');
        return res.status(403).json({ error: GDPR_DENIAL_MESSAGE });
      }
      
      if (!user.daycareId) return res.status(403).json({ error: 'Unauthorized' });
      
      const otherUser = await storage.getUser(parseInt(otherUserId));
      if (!otherUser || !canAccessDaycare(user, otherUser.daycareId!)) {
        return res.status(403).json({ error: 'Unauthorized' });
      }
      
      const messages = await storage.getConversation(user.id, parseInt(otherUserId));
      
      const enrichedMessages = await Promise.all(
        messages.map(async (msg) => {
          const sender = await storage.getUser(msg.senderId);
          const recipient = await storage.getUser(msg.recipientId);
          const child = msg.childId ? await storage.getChild(msg.childId) : null;
          
          return {
            ...msg,
            senderName: sender?.name || 'Unknown',
            recipientName: recipient?.name || 'Unknown',
            childName: child?.name || null,
          };
        })
      );
      
      res.json(enrichedMessages);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch conversation' });
    }
  });

  app.post('/api/messages', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const user = req.user!;
      
      // GDPR: Super admin cannot send messages (personal data)
      if (user.role === 'super_admin') {
        await logAudit(user.id, user.role, null, 'ACCESS_DENIED', 'messages');
        return res.status(403).json({ error: GDPR_DENIAL_MESSAGE });
      }
      
      if (!user.daycareId) return res.status(403).json({ error: 'Unauthorized' });
      
      const validatedData = insertMessageSchema.parse({
        ...req.body,
        senderId: user.id,
        daycareId: user.daycareId,
      });
      
      const recipient = await storage.getUser(validatedData.recipientId);
      if (!recipient || !canAccessDaycare(user, recipient.daycareId!)) {
        return res.status(403).json({ error: 'Unauthorized' });
      }
      
      // Guardians can only message staff/admin about their children
      if (user.role === 'guardian') {
        if (!validatedData.childId) {
          return res.status(400).json({ error: 'Child context required for guardian messages' });
        }
        
        if (recipient.role !== 'daycareleader' && recipient.role !== 'staff') {
          return res.status(403).json({ error: 'Guardians can only message staff or admins' });
        }
        
        const guardianChildren = await storage.getChildrenByGuardian(user.id);
        const isGuardianOfChild = guardianChildren.some(c => c.id === validatedData.childId);
        if (!isGuardianOfChild) {
          return res.status(403).json({ error: 'Unauthorized' });
        }
      }
      
      const message = await storage.createMessage(validatedData);
      
      // Create notification for recipient
      await storage.createNotification({
        userId: validatedData.recipientId,
        daycareId: validatedData.daycareId,
        type: 'message',
        title: 'new_message',
        message: JSON.stringify({ senderName: user.name }),
        relatedId: message.id,
      });

      void sendPushToUsers([validatedData.recipientId], {
        title: user.name,
        body: validatedData.content.slice(0, 120),
        data: { type: 'message', messageId: String(message.id) },
      });
      
      await logAudit(user.id, user.role, user.daycareId, 'CREATE', 'message', message.id);
      res.json(message);
    } catch (error) {
      res.status(400).json({ error: 'Invalid request' });
    }
  });

  app.patch('/api/messages/:id/read', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const user = req.user!;
      if (!user.daycareId) return res.status(403).json({ error: 'Unauthorized' });
      
      const { id } = req.params;
      const messageId = parseInt(id);
      
      // Fetch the message to verify the caller is the recipient.
      // Looked up by id rather than by scanning the caller's message list: the list
      // is capped, so a message older than the cap could not be marked read at all.
      const message = await storage.getMessageById(messageId);
      
      if (!message || message.daycareId !== user.daycareId) {
        return res.status(404).json({ error: 'Message not found' });
      }
      
      if (message.recipientId !== user.id) {
        return res.status(403).json({ error: 'Unauthorized' });
      }
      
      await storage.markMessageAsRead(messageId);
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: 'Invalid request' });
    }
  });

  app.get('/api/documents', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const user = req.user!;
      const { type } = req.query;
      
      // GDPR: Super admin cannot access documents (may contain personal data)
      if (user.role === 'super_admin') {
        await logAudit(user.id, user.role, null, 'ACCESS_DENIED', 'documents');
        return res.status(403).json({ error: GDPR_DENIAL_MESSAGE });
      }
      
      if (!user.daycareId) return res.status(403).json({ error: 'Unauthorized' });
      
      const documents = type 
        ? await storage.getDocumentsByType(user.daycareId, type as string)
        : await storage.getDocuments(user.daycareId);
      
      res.json(documents);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch documents' });
    }
  });

  app.post('/api/documents', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const user = req.user!;
      
      if (user.role !== 'daycareleader' && user.role !== 'staff') {
        return res.status(403).json({ error: 'Unauthorized' });
      }
      
      if (!user.daycareId) return res.status(403).json({ error: 'Unauthorized' });
      
      const validatedData = insertDocumentSchema.parse({
        ...req.body,
        publishedById: user.id,
        daycareId: user.daycareId,
      });
      
      const document = await storage.createDocument(validatedData);
      
      await logAudit(user.id, user.role, user.daycareId, 'CREATE', 'document', document.id);
      res.json(document);
    } catch (error) {
      res.status(400).json({ error: 'Invalid request' });
    }
  });

  // Notification endpoints
  app.get('/api/notifications', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const user = req.user!;
      const { limit: notifLimit, offset: notifOffset } = readPagination(req, LIST_LIMITS.notifications);
      const notifications = await storage.getNotifications(user.id, notifLimit, notifOffset);
      res.json(notifications);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch notifications' });
    }
  });

  app.get('/api/notifications/unread-count', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const user = req.user!;
      const count = await storage.getUnreadNotificationCount(user.id);
      res.json({ count });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch unread count' });
    }
  });

  app.patch('/api/notifications/:id/read', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const user = req.user!;
      const { id } = req.params;
      const notificationId = parseInt(id);
      
      // Verify the notification belongs to the user.
      // Looked up by id rather than by scanning the caller's notification list: the
      // list is capped, so an older notification could not be marked read at all.
      const notification = await storage.getNotificationById(notificationId);
      
      if (!notification || notification.userId !== user.id) {
        return res.status(404).json({ error: 'Notification not found' });
      }
      
      await storage.markNotificationAsRead(notificationId);
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: 'Failed to mark notification as read' });
    }
  });

  app.patch('/api/notifications/read-all', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const user = req.user!;
      await storage.markAllNotificationsAsRead(user.id);
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: 'Failed to mark all notifications as read' });
    }
  });

  // ===== FORMS SYSTEM =====
  
  // Admin: Get all forms for daycare
  app.get('/api/forms', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const user = req.user!;
      
      if (user.role === 'super_admin') {
        await logAudit(user.id, user.role, null, 'ACCESS_DENIED', 'forms');
        return res.status(403).json({ error: GDPR_DENIAL_MESSAGE });
      }
      
      if (!user.daycareId) return res.status(403).json({ error: 'Unauthorized' });
      
      // Guardians only see active forms, admin/staff see all
      const forms = user.role === 'guardian' 
        ? await storage.getActiveForms(user.daycareId)
        : await storage.getForms(user.daycareId);
      
      res.json(forms);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch forms' });
    }
  });
  
  // Get single form
  app.get('/api/forms/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const user = req.user!;
      const { id } = req.params;
      
      if (user.role === 'super_admin') {
        await logAudit(user.id, user.role, null, 'ACCESS_DENIED', 'forms');
        return res.status(403).json({ error: GDPR_DENIAL_MESSAGE });
      }
      
      const form = await storage.getForm(parseInt(id));
      if (!form) {
        return res.status(404).json({ error: 'Form not found' });
      }
      
      if (!canAccessDaycare(user, form.daycareId)) {
        return res.status(403).json({ error: 'Unauthorized' });
      }
      
      res.json(form);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch form' });
    }
  });
  
  // Admin: Create new form
  app.post('/api/forms', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const user = req.user!;
      
      if (user.role === 'super_admin') {
        await logAudit(user.id, user.role, null, 'ACCESS_DENIED', 'forms');
        return res.status(403).json({ error: GDPR_DENIAL_MESSAGE });
      }
      
      if (user.role !== 'daycareleader') {
        return res.status(403).json({ error: 'Only administrators can create forms' });
      }
      
      if (!user.daycareId) return res.status(403).json({ error: 'Unauthorized' });
      
      const validatedData = insertFormSchema.parse({
        ...req.body,
        daycareId: user.daycareId,
        createdById: user.id,
      });
      
      const form = await storage.createForm(validatedData);
      await logAudit(user.id, user.role, user.daycareId, 'CREATE', 'form', form.id);
      res.json(form);
    } catch (error) {
      console.error('Form creation error:', error);
      res.status(400).json({ error: 'Invalid request' });
    }
  });
  
  // Admin: Update form
  app.patch('/api/forms/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const user = req.user!;
      const { id } = req.params;
      
      if (user.role === 'super_admin') {
        await logAudit(user.id, user.role, null, 'ACCESS_DENIED', 'forms');
        return res.status(403).json({ error: GDPR_DENIAL_MESSAGE });
      }
      
      if (user.role !== 'daycareleader') {
        return res.status(403).json({ error: 'Only administrators can update forms' });
      }
      
      const form = await storage.getForm(parseInt(id));
      if (!form) {
        return res.status(404).json({ error: 'Form not found' });
      }
      
      if (!canAccessDaycare(user, form.daycareId)) {
        return res.status(403).json({ error: 'Unauthorized' });
      }
      
      const updated = await storage.updateForm(parseInt(id), req.body);
      await logAudit(user.id, user.role, user.daycareId, 'UPDATE', 'form', form.id);
      res.json(updated);
    } catch (error) {
      res.status(400).json({ error: 'Invalid request' });
    }
  });
  
  // Admin: Delete form
  app.delete('/api/forms/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const user = req.user!;
      const { id } = req.params;
      
      if (user.role === 'super_admin') {
        await logAudit(user.id, user.role, null, 'ACCESS_DENIED', 'forms');
        return res.status(403).json({ error: GDPR_DENIAL_MESSAGE });
      }
      
      if (user.role !== 'daycareleader') {
        return res.status(403).json({ error: 'Only administrators can delete forms' });
      }
      
      const form = await storage.getForm(parseInt(id));
      if (!form) {
        return res.status(404).json({ error: 'Form not found' });
      }
      
      if (!canAccessDaycare(user, form.daycareId)) {
        return res.status(403).json({ error: 'Unauthorized' });
      }
      
      await storage.deleteForm(parseInt(id));
      await logAudit(user.id, user.role, user.daycareId, 'DELETE', 'form', form.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete form' });
    }
  });
  
  // Get form submissions (admin/staff)
  app.get('/api/forms/:id/submissions', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const user = req.user!;
      const { id } = req.params;
      
      if (user.role === 'super_admin') {
        await logAudit(user.id, user.role, null, 'ACCESS_DENIED', 'form_submissions');
        return res.status(403).json({ error: GDPR_DENIAL_MESSAGE });
      }
      
      if (user.role !== 'daycareleader' && user.role !== 'staff') {
        return res.status(403).json({ error: 'Unauthorized' });
      }
      
      const form = await storage.getForm(parseInt(id));
      if (!form) {
        return res.status(404).json({ error: 'Form not found' });
      }
      
      if (!canAccessDaycare(user, form.daycareId)) {
        return res.status(403).json({ error: 'Unauthorized' });
      }
      
      const submissions = await storage.getFormSubmissions(parseInt(id));
      
      // Enrich with user and child names
      const enrichedSubmissions = await Promise.all(
        submissions.map(async (sub) => {
          const submitter = await storage.getUser(sub.submittedById);
          const child = sub.childId ? await storage.getChild(sub.childId) : null;
          return {
            ...sub,
            submitterName: submitter?.name || 'Unknown',
            childName: child?.name || null,
          };
        })
      );
      
      res.json(enrichedSubmissions);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch submissions' });
    }
  });
  
  // Guardian: Submit form
  app.post('/api/forms/:id/submit', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const user = req.user!;
      const { id } = req.params;
      
      if (user.role === 'super_admin') {
        await logAudit(user.id, user.role, null, 'ACCESS_DENIED', 'form_submissions');
        return res.status(403).json({ error: GDPR_DENIAL_MESSAGE });
      }
      
      if (user.role !== 'guardian') {
        return res.status(403).json({ error: 'Only guardians can submit forms' });
      }
      
      if (!user.daycareId) return res.status(403).json({ error: 'Unauthorized' });
      
      const form = await storage.getForm(parseInt(id));
      if (!form) {
        return res.status(404).json({ error: 'Form not found' });
      }
      
      if (!canAccessDaycare(user, form.daycareId)) {
        return res.status(403).json({ error: 'Unauthorized' });
      }
      
      const { childId, responses } = req.body;
      
      // Verify child access if form requires child context
      if (form.requiresChildContext) {
        if (!childId) {
          return res.status(400).json({ error: 'Child selection required for this form' });
        }
        
        const guardianChildren = await storage.getChildrenByGuardian(user.id);
        const hasAccess = guardianChildren.some(c => c.id === childId);
        if (!hasAccess) {
          return res.status(403).json({ error: 'Unauthorized - not guardian of this child' });
        }
        
        // Check if already submitted for this child
        const exists = await storage.checkFormSubmissionExists(parseInt(id), childId);
        if (exists) {
          return res.status(400).json({ error: 'Form already submitted for this child' });
        }
      } else {
        // Check if already submitted by this user
        const exists = await storage.checkFormSubmissionExists(parseInt(id), undefined, user.id);
        if (exists) {
          return res.status(400).json({ error: 'Form already submitted' });
        }
      }
      
      const validatedData = insertFormSubmissionSchema.parse({
        formId: parseInt(id),
        daycareId: user.daycareId,
        submittedById: user.id,
        childId: childId || null,
        responses,
      });
      
      const submission = await storage.createFormSubmission(validatedData);
      await logAudit(user.id, user.role, user.daycareId, 'CREATE', 'form_submission', submission.id);
      res.json(submission);
    } catch (error) {
      console.error('Form submission error:', error);
      res.status(400).json({ error: 'Invalid request' });
    }
  });
  
  // Guardian: Get my form submissions
  app.get('/api/my-submissions', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const user = req.user!;
      
      if (user.role === 'super_admin') {
        await logAudit(user.id, user.role, null, 'ACCESS_DENIED', 'form_submissions');
        return res.status(403).json({ error: GDPR_DENIAL_MESSAGE });
      }
      
      const submissions = await storage.getFormSubmissionsByUser(user.id);
      
      // Enrich with form titles and child names
      const enrichedSubmissions = await Promise.all(
        submissions.map(async (sub) => {
          const form = await storage.getForm(sub.formId);
          const child = sub.childId ? await storage.getChild(sub.childId) : null;
          return {
            ...sub,
            formTitle: form?.title || 'Unknown Form',
            childName: child?.name || null,
          };
        })
      );
      
      res.json(enrichedSubmissions);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch submissions' });
    }
  });
  
  // ===== CHILD CONSENTS =====
  
  // Get child's consents (for parent/staff/admin)
  app.get('/api/children/:childId/consents', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const user = req.user!;
      const { childId } = req.params;
      
      if (user.role === 'super_admin') {
        await logAudit(user.id, user.role, null, 'ACCESS_DENIED', 'child_consents');
        return res.status(403).json({ error: GDPR_DENIAL_MESSAGE });
      }
      
      const child = await storage.getChild(parseInt(childId));
      if (!child) {
        return res.status(404).json({ error: 'Child not found' });
      }
      
      // Verify access
      if (user.role === 'guardian') {
        const guardianChildren = await storage.getChildrenByGuardian(user.id);
        const hasAccess = guardianChildren.some(c => c.id === parseInt(childId));
        if (!hasAccess) {
          return res.status(403).json({ error: 'Unauthorized' });
        }
      } else if (user.role === 'staff' || user.role === 'daycareleader') {
        if (!canAccessDaycare(user, child.daycareId)) {
          return res.status(403).json({ error: 'Unauthorized' });
        }
      } else {
        return res.status(403).json({ error: 'Unauthorized' });
      }
      
      const consents = await storage.getChildConsents(parseInt(childId));
      res.json(consents);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch consents' });
    }
  });
  
  // Guardian: Update child consent
  app.post('/api/children/:childId/consents', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const user = req.user!;
      const { childId } = req.params;
      
      if (user.role === 'super_admin') {
        await logAudit(user.id, user.role, null, 'ACCESS_DENIED', 'child_consents');
        return res.status(403).json({ error: GDPR_DENIAL_MESSAGE });
      }
      
      if (user.role !== 'guardian') {
        return res.status(403).json({ error: 'Only guardians can update consent settings' });
      }
      
      const child = await storage.getChild(parseInt(childId));
      if (!child) {
        return res.status(404).json({ error: 'Child not found' });
      }
      
      // Verify guardian has access to this child
      const guardianChildren = await storage.getChildrenByGuardian(user.id);
      const hasAccess = guardianChildren.some(c => c.id === parseInt(childId));
      if (!hasAccess) {
        return res.status(403).json({ error: 'Unauthorized - not guardian of this child' });
      }
      
      const validatedData = insertChildConsentSchema.parse({
        childId: parseInt(childId),
        daycareId: child.daycareId,
        consentType: req.body.consentType,
        granted: req.body.granted,
        grantedById: user.id,
        notes: req.body.notes,
      });
      
      const consent = await storage.createOrUpdateChildConsent(validatedData);
      await logAudit(user.id, user.role, user.daycareId, 'UPDATE', 'child_consent', consent.id);
      res.json(consent);
    } catch (error) {
      console.error('Consent update error:', error);
      res.status(400).json({ error: 'Invalid request' });
    }
  });
  
  // Admin/Staff: Get all consents for daycare (overview)
  app.get('/api/consents', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const user = req.user!;
      
      if (user.role === 'super_admin') {
        await logAudit(user.id, user.role, null, 'ACCESS_DENIED', 'child_consents');
        return res.status(403).json({ error: GDPR_DENIAL_MESSAGE });
      }
      
      if (user.role !== 'daycareleader' && user.role !== 'staff') {
        return res.status(403).json({ error: 'Unauthorized' });
      }
      
      if (!user.daycareId) return res.status(403).json({ error: 'Unauthorized' });
      
      const consents = await storage.getChildConsentsByDaycare(user.daycareId);
      
      // Enrich with child names
      const enrichedConsents = await Promise.all(
        consents.map(async (consent) => {
          const child = await storage.getChild(consent.childId);
          const grantedBy = await storage.getUser(consent.grantedById);
          return {
            ...consent,
            childName: child?.name || 'Unknown',
            grantedByName: grantedBy?.name || 'Unknown',
          };
        })
      );
      
      res.json(enrichedConsents);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch consents' });
    }
  });

  // Meal Menu endpoints (available to guardian, staff, admin - NOT super_admin)
  // GET /api/menu - Get today's menu
  app.get('/api/menu', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const user = req.user!;
      
      // Super admin cannot access meal menus (GDPR - no daycare-specific data)
      if (user.role === 'super_admin') {
        return res.status(403).json({ error: 'Super admin cannot access meal menus' });
      }
      
      if (!user.daycareId) return res.status(403).json({ error: 'Unauthorized' });
      
      // Get daycare menu settings
      const daycare = await storage.getDaycare(user.daycareId);
      if (!daycare) return res.status(404).json({ error: 'Daycare not found' });
      
      // Determine effective menu source (daycare override or municipality default)
      let effectiveSourceType = daycare.menuSourceType;
      
      // If daycare has no menu source, check municipality default
      if ((!effectiveSourceType || effectiveSourceType === 'none') && daycare.municipalityId) {
        const municipality = await storage.getMunicipality(daycare.municipalityId);
        if (municipality && municipality.defaultMenuSourceType && municipality.defaultMenuSourceType !== 'none') {
          effectiveSourceType = municipality.defaultMenuSourceType;
        }
      }
      
      // Get today's date in YYYY-MM-DD format
      const today = new Date().toISOString().split('T')[0];
      
      // Fetch menu based on effective menu source type
      let items: MealMenu[] = [];
      if (effectiveSourceType === 'manual' || effectiveSourceType === 'aromi') {
        items = await storage.getMealMenuByDate(today, user.daycareId);
      }
      
      res.json({ date: today, items, menuSourceType: effectiveSourceType || 'none', dietLegend: dietInfoLegend });
    } catch (error) {
      console.error('Error fetching menu:', error);
      res.status(500).json({ error: 'Failed to fetch menu' });
    }
  });

  // GET /api/menu/week - Get current week's menu (MUST be before /api/menu/:date)
  app.get('/api/menu/week', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const user = req.user!;
      
      if (user.role === 'super_admin') {
        return res.status(403).json({ error: 'Super admin cannot access meal menus' });
      }
      
      if (!user.daycareId) return res.status(403).json({ error: 'Unauthorized' });
      
      // Get current week's Monday and Friday (daycare is Mon-Fri only)
      const today = new Date();
      const dayOfWeek = today.getDay();
      const monday = new Date(today);
      monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
      const friday = new Date(monday);
      friday.setDate(monday.getDate() + 4);
      
      const startDate = monday.toISOString().split('T')[0];
      const endDate = friday.toISOString().split('T')[0];
      
      const items = await storage.getMealMenuByDateRange(startDate, endDate, user.daycareId);
      
      // Group by date for frontend convenience (only weekdays)
      const menuByDate: Record<string, typeof items> = {};
      for (const item of items) {
        const itemDate = new Date(item.date);
        const itemDayOfWeek = itemDate.getDay();
        // Skip weekends (Saturday = 6, Sunday = 0)
        if (itemDayOfWeek === 0 || itemDayOfWeek === 6) continue;
        
        if (!menuByDate[item.date]) {
          menuByDate[item.date] = [];
        }
        menuByDate[item.date].push(item);
      }
      
      res.json({ 
        startDate, 
        endDate, 
        menuByDate, 
        dietLegend: dietInfoLegend 
      });
    } catch (error) {
      console.error('Error fetching week menu:', error);
      res.status(500).json({ error: 'Failed to fetch week menu' });
    }
  });

  // GET /api/menu/:date - Get menu for specific date
  app.get('/api/menu/:date', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const user = req.user!;
      
      // Super admin cannot access meal menus
      if (user.role === 'super_admin') {
        return res.status(403).json({ error: 'Super admin cannot access meal menus' });
      }
      
      if (!user.daycareId) return res.status(403).json({ error: 'Unauthorized' });
      
      const { date } = req.params;
      const items = await storage.getMealMenuByDate(date, user.daycareId);
      res.json({ date, items, dietLegend: dietInfoLegend });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch menu' });
    }
  });

  // Staff/Admin: Manual menu refresh (triggers Aromi scraper for this daycare)
  app.post('/api/menu/refresh', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const user = req.user!;
      
      // Only staff and admin roles can refresh menu (super_admin blocked from menu access)
      if (user.role === 'super_admin') {
        await logAudit(user.id, user.role, null, 'ACCESS_DENIED', 'menu', undefined, { reason: 'GDPR' });
        return res.status(403).json({ error: GDPR_DENIAL_MESSAGE });
      }
      
      if (user.role !== 'daycareleader' && user.role !== 'staff' && user.role !== 'admin') {
        return res.status(403).json({ error: 'Unauthorized' });
      }
      
      if (!user.daycareId) return res.status(403).json({ error: 'Unauthorized' });
      
      // Get daycare to check menu source
      const daycare = await storage.getDaycare(user.daycareId);
      if (!daycare) return res.status(404).json({ error: 'Daycare not found' });
      
      // Determine effective menu source (daycare override or municipality default)
      let effectiveSourceType = daycare.menuSourceType;
      let effectiveSourceUrl = daycare.menuSourceUrl;
      
      // If daycare has no menu source, check municipality default
      if ((!effectiveSourceType || effectiveSourceType === 'none') && daycare.municipalityId) {
        const municipality = await storage.getMunicipality(daycare.municipalityId);
        if (municipality && municipality.defaultMenuSourceType === 'aromi' && municipality.defaultMenuSourceUrl) {
          effectiveSourceType = municipality.defaultMenuSourceType;
          effectiveSourceUrl = municipality.defaultMenuSourceUrl;
        }
      }
      
      if (effectiveSourceType !== 'aromi') {
        return res.status(400).json({ error: 'This daycare does not use Aromi menu source' });
      }
      
      // Fetch menu for this specific daycare from Aromi
      const result = await fetchAndSaveMenuForDaycare(user.daycareId, effectiveSourceUrl || undefined);
      res.json(result);
    } catch (error) {
      console.error('Error refreshing menu:', error);
      res.status(500).json({ error: 'Failed to refresh menu' });
    }
  });
  
  // Admin: Add manual menu item
  app.post('/api/menu', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const user = req.user!;
      
      if (user.role === 'super_admin') {
        return res.status(403).json({ error: GDPR_DENIAL_MESSAGE });
      }
      
      if (user.role !== 'daycareleader') {
        return res.status(403).json({ error: 'Only administrators can add menu items' });
      }
      
      if (!user.daycareId) return res.status(403).json({ error: 'Unauthorized' });
      
      const { date, mealType, foodName, foodDescription, dietInfo } = req.body;
      
      if (!date || !mealType || !foodName) {
        return res.status(400).json({ error: 'Missing required fields: date, mealType, foodName' });
      }
      
      const menu = await storage.createMealMenu({
        daycareId: user.daycareId,
        date,
        mealType,
        foodName,
        foodDescription,
        dietInfo,
      });
      
      res.json(menu);
    } catch (error) {
      res.status(500).json({ error: 'Failed to add menu item' });
    }
  });
  
  // Admin: Delete menu items for a date
  app.delete('/api/menu/:date', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const user = req.user!;
      
      if (user.role === 'super_admin') {
        return res.status(403).json({ error: GDPR_DENIAL_MESSAGE });
      }
      
      if (user.role !== 'daycareleader') {
        return res.status(403).json({ error: 'Only administrators can delete menu items' });
      }
      
      if (!user.daycareId) return res.status(403).json({ error: 'Unauthorized' });
      
      const { date } = req.params;
      await storage.deleteMealMenuByDate(date, user.daycareId);
      
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: 'Failed to delete menu items' });
    }
  });
  
  // Admin: Get/update daycare menu settings
  app.get('/api/daycare/menu-settings', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const user = req.user!;
      
      if (user.role === 'super_admin') {
        return res.status(403).json({ error: GDPR_DENIAL_MESSAGE });
      }
      
      if (user.role !== 'daycareleader') {
        return res.status(403).json({ error: 'Only administrators can view menu settings' });
      }
      
      if (!user.daycareId) return res.status(403).json({ error: 'Unauthorized' });
      
      const daycare = await storage.getDaycare(user.daycareId);
      if (!daycare) return res.status(404).json({ error: 'Daycare not found' });
      
      res.json({
        municipality: daycare.municipality,
        menuSourceType: daycare.menuSourceType,
        menuSourceUrl: daycare.menuSourceUrl,
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch menu settings' });
    }
  });
  
  app.patch('/api/daycare/menu-settings', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const user = req.user!;
      
      if (user.role === 'super_admin') {
        return res.status(403).json({ error: GDPR_DENIAL_MESSAGE });
      }
      
      if (user.role !== 'daycareleader') {
        return res.status(403).json({ error: 'Only administrators can update menu settings' });
      }
      
      if (!user.daycareId) return res.status(403).json({ error: 'Unauthorized' });
      
      const { municipality, menuSourceType, menuSourceUrl } = req.body;
      
      const daycare = await storage.updateDaycareMenuSettings(user.daycareId, {
        municipality,
        menuSourceType,
        menuSourceUrl,
      });
      
      res.json({
        municipality: daycare.municipality,
        menuSourceType: daycare.menuSourceType,
        menuSourceUrl: daycare.menuSourceUrl,
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to update menu settings' });
    }
  });

  // Push notification token registration
  app.post('/api/push-token', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const user = req.user!;
      const { token, platform } = req.body;
      
      if (!token || !platform) {
        return res.status(400).json({ error: 'Missing token or platform' });
      }
      
      await storage.savePushToken(user.id, token, platform);
      res.json({ success: true });
    } catch (error) {
      console.error('Error saving push token:', error);
      res.status(500).json({ error: 'Failed to save push token' });
    }
  });
  
  // Remove push notification token (for logout)
  app.delete('/api/push-token', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const user = req.user!;
      const { token } = req.body;
      
      if (!token) {
        return res.status(400).json({ error: 'Missing token' });
      }
      
      await storage.deletePushToken(user.id, token);
      res.json({ success: true });
    } catch (error) {
      console.error('Error removing push token:', error);
      res.status(500).json({ error: 'Failed to remove push token' });
    }
  });

  // ==================== GDPR SELF-SERVICE ENDPOINTS ====================
  
  // Guardian: Export all personal data (GDPR Article 20)
  app.get('/api/gdpr/export', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const user = req.user!;
      
      // Only guardians can export their own data
      if (user.role !== 'guardian') {
        return res.status(403).json({ error: 'Only guardians can export their personal data' });
      }
      
      const data = await storage.getGuardianDataExport(user.id);
      
      // Log the data export for GDPR compliance
      await logAudit(user.id, user.role, user.daycareId, 'VIEW', 'gdpr_export', user.id);
      
      // Return as downloadable JSON
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', attachment(`gdpr-export-${user.id}-${new Date().toISOString().split('T')[0]}.json`));
      res.json(data);
    } catch (error) {
      console.error('Error exporting GDPR data:', error);
      res.status(500).json({ error: 'Failed to export data' });
    }
  });
  
  // Guardian: Request data deletion (GDPR Article 17)
  app.post('/api/gdpr/delete-request', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const user = req.user!;
      
      // Only guardians can request deletion
      if (user.role !== 'guardian') {
        return res.status(403).json({ error: 'Only guardians can request data deletion' });
      }
      
      const { reason } = req.body;
      
      // Check if there's already a pending request
      const existingRequests = await storage.getDeleteRequestsByUser(user.id);
      const pendingRequest = existingRequests.find(r => r.status === 'pending');
      if (pendingRequest) {
        return res.status(400).json({ error: 'You already have a pending deletion request' });
      }
      
      const request = await storage.createDeleteRequest({
        userId: user.id,
        daycareId: user.daycareId,
        reason,
      });
      
      await logAudit(user.id, user.role, user.daycareId, 'CREATE', 'delete_request', request.id);
      
      res.json(request);
    } catch (error) {
      console.error('Error creating delete request:', error);
      res.status(500).json({ error: 'Failed to create deletion request' });
    }
  });
  
  // Guardian: Get own deletion requests
  app.get('/api/gdpr/my-delete-requests', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const user = req.user!;
      
      if (user.role !== 'guardian') {
        return res.status(403).json({ error: 'Only guardians can view their deletion requests' });
      }
      
      const requests = await storage.getDeleteRequestsByUser(user.id);
      res.json(requests);
    } catch (error) {
      console.error('Error fetching delete requests:', error);
      res.status(500).json({ error: 'Failed to fetch deletion requests' });
    }
  });
  
  // Admin: Get all deletion requests for their daycare
  app.get('/api/gdpr/delete-requests', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const user = req.user!;
      
      if (user.role !== 'daycareleader' && user.role !== 'staff') {
        return res.status(403).json({ error: 'Only staff can view deletion requests' });
      }
      
      if (!user.daycareId) {
        return res.status(403).json({ error: 'Unauthorized' });
      }
      
      const requests = await storage.getDeleteRequests(user.daycareId);
      
      // Enrich with user names (only for admin purposes)
      const enrichedRequests = await Promise.all(requests.map(async (request) => {
        const requestUser = await storage.getUser(request.userId);
        return {
          ...request,
          userName: requestUser?.name || 'Unknown',
          userEmail: requestUser?.email || 'Unknown',
        };
      }));
      
      res.json(enrichedRequests);
    } catch (error) {
      console.error('Error fetching delete requests:', error);
      res.status(500).json({ error: 'Failed to fetch deletion requests' });
    }
  });
  
  // Admin: Approve or deny deletion request
  app.patch('/api/gdpr/delete-requests/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const user = req.user!;
      
      if (user.role !== 'daycareleader') {
        return res.status(403).json({ error: 'Only administrators can process deletion requests' });
      }
      
      if (!user.daycareId) {
        return res.status(403).json({ error: 'Unauthorized' });
      }
      
      const requestId = parseInt(req.params.id);
      const { status, adminNote } = req.body;
      
      if (!status || !['approved', 'denied'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status. Must be "approved" or "denied"' });
      }
      
      // Verify the request belongs to this daycare
      const existingRequest = await storage.getDeleteRequest(requestId);
      if (!existingRequest || existingRequest.daycareId !== user.daycareId) {
        return res.status(404).json({ error: 'Request not found' });
      }
      
      const updated = await storage.updateDeleteRequestStatus(requestId, status, user.id, adminNote);
      
      await logAudit(user.id, user.role, user.daycareId, 'UPDATE', 'delete_request', requestId, { status });
      
      res.json(updated);
    } catch (error) {
      console.error('Error updating delete request:', error);
      res.status(500).json({ error: 'Failed to update deletion request' });
    }
  });
  
  // Healthz endpoint for Kubernetes/container health checks (no auth required)
  app.get('/healthz', async (req: Request, res: Response) => {
    try {
      const dbHealthy = await storage.checkDatabaseConnection();
      
      if (dbHealthy) {
        res.status(200).json({ status: 'ok' });
      } else {
        res.status(503).json({ status: 'unhealthy', reason: 'database' });
      }
    } catch (error) {
      res.status(503).json({ status: 'error' });
    }
  });
  
  // Audit logs endpoint for admin UI
  app.get('/api/audit-logs', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const user = req.user!;
      
      // Only daycare leaders can view audit logs
      if (user.role !== 'daycareleader' && user.role !== 'super_admin') {
        return res.status(403).json({ error: 'Only administrators can view audit logs' });
      }
      
      const limit = parseInt(req.query.limit as string) || 100;
      const offset = parseInt(req.query.offset as string) || 0;
      
      // Regular admin sees only their daycare's logs
      // Super admin sees all logs but no personal data
      const daycareId = user.role === 'super_admin' ? undefined : user.daycareId || undefined;
      
      const logs = await storage.getAuditLogs(daycareId, limit, offset);
      
      // Sanitize logs - remove any metadata that might contain PII
      const sanitizedLogs = logs.map(log => ({
        id: log.id,
        timestamp: log.timestamp,
        actorRole: log.actorRole,
        action: log.action,
        entityType: log.entityType,
        entityIdHash: log.entityIdHash,
        // Explicitly exclude metadata to prevent PII exposure
      }));
      
      res.json(sanitizedLogs);
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      res.status(500).json({ error: 'Failed to fetch audit logs' });
    }
  });

  // ===== CARE TIME: reservations and realised attendance =====
  //
  // All new endpoints, under their own prefix. Nothing above this line changed,
  // so a phone app built before this release keeps working unmodified.

  /**
   * Common gate for every care-time endpoint.
   *
   * Returns the daycare when the caller may proceed, and answers the request
   * itself otherwise. Three things are checked in one place because forgetting
   * any of them on one endpoint is how tenant leaks happen: super admin is
   * refused personal data, the caller must belong to a daycare, and the daycare
   * must have the feature switched on.
   */
  async function careTimeContext(
    req: AuthRequest,
    res: Response,
  ): Promise<{ user: NonNullable<AuthRequest['user']>; daycare: Awaited<ReturnType<typeof storage.getDaycare>> } | null> {
    const user = req.user!;
    const daycare = user.daycareId ? await storage.getDaycare(user.daycareId) : undefined;

    const denial = careTimeAccessDenial(user, daycare);
    if (denial) {
      if (denial.reason === 'gdpr') {
        await logAudit(user.id, user.role, null, 'ACCESS_DENIED', 'care_time');
        res.status(denial.status).json({ error: GDPR_DENIAL_MESSAGE });
      } else if (denial.reason === 'disabled') {
        res.status(denial.status).json({ error: 'Care time reservations are not enabled for this daycare' });
      } else {
        res.status(denial.status).json({ error: 'Unauthorized' });
      }
      return null;
    }

    return { user, daycare };
  }

  /**
   * The children this caller may act on: their own if a guardian, the whole
   * daycare otherwise. Returned as ids so every query below can be narrowed with
   * them rather than trusting a childId from the request.
   */
  async function accessibleChildIds(user: NonNullable<AuthRequest['user']>): Promise<number[]> {
    if (user.role === 'guardian') {
      const own = await storage.getChildrenByGuardian(user.id);
      return own.map((child) => child.id);
    }
    const all = await storage.getChildren(user.daycareId!);
    return all.map((child) => child.id);
  }

  const isIsoDate = (value: unknown): value is string =>
    typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);

  /**
   * Whether this caller's daycare has care time switched on.
   *
   * Its own endpoint so the navigation can hide the pages without every other
   * endpoint having to answer 404 first, and without widening the response of
   * any endpoint a released phone build already reads.
   */
  app.get('/api/care-time/enabled', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const user = req.user!;
      if (user.role === 'super_admin' || !user.daycareId) return res.json({ enabled: false });

      const daycare = await storage.getDaycare(user.daycareId);
      res.json({ enabled: daycare?.reservationsEnabled === true });
    } catch (error) {
      res.json({ enabled: false });
    }
  });

  app.get('/api/care-time/reservations', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const context = await careTimeContext(req, res);
      if (!context) return;
      const { user } = context;

      const { from, to } = req.query;
      if (!isIsoDate(from) || !isIsoDate(to) || from > to) {
        return res.status(400).json({ error: 'from and to must be YYYY-MM-DD, from before to' });
      }

      const childIds = await accessibleChildIds(user);
      const reservations = await storage.getReservations(user.daycareId!, from, to, childIds);
      res.json(reservations);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch reservations' });
    }
  });

  app.put('/api/care-time/reservations', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const context = await careTimeContext(req, res);
      if (!context) return;
      const { user, daycare } = context;

      const validatedData = insertReservationSchema.parse(req.body);

      const childIds = await accessibleChildIds(user);
      if (!canActOnChild(childIds, validatedData.childId)) {
        return res.status(403).json({ error: 'Unauthorized' });
      }

      // Staff may still correct a booking after it closes; the deadline exists to
      // stop guardians changing a week the daycare has already staffed.
      if (user.role === 'guardian' && isReservationLocked(validatedData.date, daycare!)) {
        return res.status(409).json({
          error: 'Reservations for that week are closed',
          deadline: reservationDeadline(validatedData.date, daycare!).toISOString(),
        });
      }

      const saved = await storage.upsertReservation({
        ...validatedData,
        daycareId: user.daycareId!,
        createdById: user.id,
      });

      await logAudit(user.id, user.role, user.daycareId!, 'UPDATE', 'reservation', saved.id);
      res.json(saved);
    } catch (error) {
      res.status(400).json({ error: 'Invalid request' });
    }
  });

  app.delete('/api/care-time/reservations', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const context = await careTimeContext(req, res);
      if (!context) return;
      const { user, daycare } = context;

      const childId = Number(req.query.childId);
      const { date } = req.query;
      if (!Number.isInteger(childId) || !isIsoDate(date)) {
        return res.status(400).json({ error: 'childId and date are required' });
      }

      const childIds = await accessibleChildIds(user);
      if (!canActOnChild(childIds, childId)) {
        return res.status(403).json({ error: 'Unauthorized' });
      }

      if (user.role === 'guardian' && isReservationLocked(date, daycare!)) {
        return res.status(409).json({ error: 'Reservations for that week are closed' });
      }

      const removed = await storage.deleteReservation(childId, user.daycareId!, date);
      if (!removed) return res.status(404).json({ error: 'Reservation not found' });

      await logAudit(user.id, user.role, user.daycareId!, 'DELETE', 'reservation');
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: 'Invalid request' });
    }
  });

  app.get('/api/care-time/template/:childId', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const context = await careTimeContext(req, res);
      if (!context) return;
      const { user } = context;

      const childId = parseInt(req.params.childId);
      if (Number.isNaN(childId)) return res.status(400).json({ error: 'Invalid request' });

      const childIds = await accessibleChildIds(user);
      if (!canActOnChild(childIds, childId)) {
        return res.status(403).json({ error: 'Unauthorized' });
      }

      res.json(await storage.getReservationTemplate(childId, user.daycareId!));
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch template' });
    }
  });

  app.put('/api/care-time/template', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const context = await careTimeContext(req, res);
      if (!context) return;
      const { user } = context;

      const validatedData = reservationTemplateSchema.parse(req.body);

      const childIds = await accessibleChildIds(user);
      if (!canActOnChild(childIds, validatedData.childId)) {
        return res.status(403).json({ error: 'Unauthorized' });
      }

      const weekdays = validatedData.days.map((day) => day.weekday);
      if (new Set(weekdays).size !== weekdays.length) {
        return res.status(400).json({ error: 'Each weekday may appear only once' });
      }

      const saved = await storage.replaceReservationTemplate(
        validatedData.childId,
        user.daycareId!,
        user.id,
        validatedData.days,
      );

      await logAudit(user.id, user.role, user.daycareId!, 'UPDATE', 'reservation_template');
      res.json(saved);
    } catch (error) {
      res.status(400).json({ error: 'Invalid request' });
    }
  });

  /**
   * Fills a date range from the weekly pattern.
   *
   * Days that are already locked are skipped rather than failing the whole call,
   * and the response says how many were skipped -- a guardian applying a pattern
   * across a month should not be stopped by the current week being closed.
   * Existing bookings in range are replaced, which is what "apply my pattern"
   * means.
   */
  app.post('/api/care-time/template/apply', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const context = await careTimeContext(req, res);
      if (!context) return;
      const { user, daycare } = context;

      const validatedData = applyTemplateSchema.parse(req.body);
      if (!isIsoDate(validatedData.from) || !isIsoDate(validatedData.to) || validatedData.from > validatedData.to) {
        return res.status(400).json({ error: 'from and to must be YYYY-MM-DD, from before to' });
      }

      const childIds = await accessibleChildIds(user);
      if (!canActOnChild(childIds, validatedData.childId)) {
        return res.status(403).json({ error: 'Unauthorized' });
      }

      const template = await storage.getReservationTemplate(validatedData.childId, user.daycareId!);
      if (template.length === 0) {
        return res.status(400).json({ error: 'No weekly template saved for this child' });
      }
      const byWeekday = new Map(template.map((day) => [day.weekday, day]));

      // Bounded so a mistyped range cannot ask for a decade of rows.
      const MAX_DAYS = 366;
      const days: string[] = [];
      for (
        let cursor = new Date(`${validatedData.from}T00:00:00Z`);
        cursor.toISOString().slice(0, 10) <= validatedData.to && days.length <= MAX_DAYS;
        cursor = new Date(cursor.getTime() + 86_400_000)
      ) {
        days.push(cursor.toISOString().slice(0, 10));
      }
      if (days.length > MAX_DAYS) {
        return res.status(400).json({ error: 'Range may not exceed one year' });
      }

      let created = 0;
      let skippedLocked = 0;
      for (const day of days) {
        const pattern = byWeekday.get(isoWeekday(day));
        if (!pattern) continue;
        if (user.role === 'guardian' && isReservationLocked(day, daycare!)) {
          skippedLocked += 1;
          continue;
        }
        await storage.upsertReservation({
          childId: validatedData.childId,
          date: day,
          startTime: pattern.startTime,
          endTime: pattern.endTime,
          daycareId: user.daycareId!,
          createdById: user.id,
        });
        created += 1;
      }

      await logAudit(user.id, user.role, user.daycareId!, 'CREATE', 'reservation', undefined, { created, skippedLocked });
      res.json({ created, skippedLocked });
    } catch (error) {
      res.status(400).json({ error: 'Invalid request' });
    }
  });

  /**
   * The staff device view: everyone expected today, who is here, and what was
   * booked. One query per table rather than per child.
   */
  app.get('/api/care-time/today', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const context = await careTimeContext(req, res);
      if (!context) return;
      const { user } = context;

      if (user.role !== 'staff' && user.role !== 'daycareleader') {
        return res.status(403).json({ error: 'Unauthorized' });
      }

      const date = isIsoDate(req.query.date) ? req.query.date : zonedDate(new Date());

      const [children, reservations, records, absencesToday] = await Promise.all([
        storage.getChildren(user.daycareId!),
        storage.getReservations(user.daycareId!, date, date),
        storage.getAttendanceRecords(user.daycareId!, date, date),
        storage.getAbsencesByDateRange(user.daycareId!, new Date(`${date}T00:00:00Z`), new Date(`${date}T00:00:00Z`)),
      ]);

      const reservationByChild = new Map(reservations.map((r) => [r.childId, r]));
      const recordsByChild = new Map<number, typeof records>();
      for (const record of records) {
        const existing = recordsByChild.get(record.childId) ?? [];
        existing.push(record);
        recordsByChild.set(record.childId, existing);
      }
      const absentChildIds = new Set(absencesToday.map((absence) => absence.childId));

      res.json({
        date,
        children: children.map((child) => {
          const childRecords = recordsByChild.get(child.id) ?? [];
          const reservation = reservationByChild.get(child.id);
          return {
            childId: child.id,
            name: child.name,
            allergies: child.allergies,
            reserved: reservation
              ? { startTime: reservation.startTime, endTime: reservation.endTime }
              : null,
            absent: absentChildIds.has(child.id),
            present: isPresent(childRecords),
            realisedMinutes: realisedMinutes(childRecords),
            openRecordId: childRecords.find((record) => record.checkOutAt === null)?.id ?? null,
          };
        }),
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch attendance' });
    }
  });

  app.post('/api/care-time/check-in', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const context = await careTimeContext(req, res);
      if (!context) return;
      const { user } = context;

      if (user.role !== 'staff' && user.role !== 'daycareleader') {
        return res.status(403).json({ error: 'Unauthorized' });
      }

      const validatedData = checkInSchema.parse(req.body);

      const children = await storage.getChildren(user.daycareId!);
      if (!children.some((child) => child.id === validatedData.childId)) {
        return res.status(403).json({ error: 'Unauthorized' });
      }

      // A second tap on an already present child returns the open stay instead of
      // opening a rival one, so a double press at a busy door cannot produce two.
      const open = await storage.getOpenAttendanceRecord(validatedData.childId, user.daycareId!);
      if (open) return res.json(open);

      const at = validatedData.at ? new Date(validatedData.at) : new Date();
      const record = await storage.createAttendanceCheckIn(
        validatedData.childId,
        user.daycareId!,
        zonedDate(at),
        at,
        user.id,
      );

      await logAudit(user.id, user.role, user.daycareId!, 'CREATE', 'attendance', record.id);
      res.json(record);
    } catch (error) {
      res.status(400).json({ error: 'Invalid request' });
    }
  });

  app.post('/api/care-time/check-out', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const context = await careTimeContext(req, res);
      if (!context) return;
      const { user } = context;

      if (user.role !== 'staff' && user.role !== 'daycareleader') {
        return res.status(403).json({ error: 'Unauthorized' });
      }

      const validatedData = checkOutSchema.parse(req.body);

      const open = await storage.getOpenAttendanceRecord(validatedData.childId, user.daycareId!);
      if (!open) return res.status(404).json({ error: 'That child is not checked in' });

      const at = validatedData.at ? new Date(validatedData.at) : new Date();
      if (at.getTime() < open.checkInAt.getTime()) {
        return res.status(400).json({ error: 'Check-out cannot be before check-in' });
      }

      const closed = await storage.closeAttendanceRecord(open.id, user.daycareId!, at, user.id);
      if (!closed) return res.status(404).json({ error: 'That child is not checked in' });

      await logAudit(user.id, user.role, user.daycareId!, 'UPDATE', 'attendance', closed.id);
      res.json(closed);
    } catch (error) {
      res.status(400).json({ error: 'Invalid request' });
    }
  });

  /** Booked against realised for one day, across the daycare. */
  app.get('/api/care-time/comparison', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const context = await careTimeContext(req, res);
      if (!context) return;
      const { user } = context;

      const date = isIsoDate(req.query.date) ? req.query.date : zonedDate(new Date());
      const childIds = await accessibleChildIds(user);

      const [reservations, records, absencesToday] = await Promise.all([
        storage.getReservations(user.daycareId!, date, date, childIds),
        storage.getAttendanceRecords(user.daycareId!, date, date, childIds),
        storage.getAbsencesByDateRange(user.daycareId!, new Date(`${date}T00:00:00Z`), new Date(`${date}T00:00:00Z`)),
      ]);

      const recordsByChild = new Map<number, typeof records>();
      for (const record of records) {
        const existing = recordsByChild.get(record.childId) ?? [];
        existing.push(record);
        recordsByChild.set(record.childId, existing);
      }
      const absentChildIds = new Set(absencesToday.map((absence) => absence.childId));

      const rows = childIds.map((childId) => {
        const reservation = reservations.find((r) => r.childId === childId);
        const childRecords = recordsByChild.get(childId) ?? [];
        return {
          childId,
          reservedMinutes: reservation ? reservedMinutes(reservation.startTime, reservation.endTime) : 0,
          realisedMinutes: realisedMinutes(childRecords),
          // An absence explains a booked day that did not happen; it does not
          // remove the booking, which the daycare still staffed for.
          absent: absentChildIds.has(childId),
          present: isPresent(childRecords),
        };
      });

      await logAudit(user.id, user.role, user.daycareId!, 'VIEW', 'care_time_comparison');
      res.json({ date, rows });
    } catch (error) {
      res.status(500).json({ error: 'Failed to build comparison' });
    }
  });

  /**
   * A month for one child: hours accrued against the agreed allowance.
   *
   * Deliberately stops at the numbers. No price, no invoice, no rounding rule --
   * those are decisions for whoever builds billing, and guessing them here would
   * bake an assumption into data that is meant to be neutral.
   */
  app.get('/api/care-time/summary', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const context = await careTimeContext(req, res);
      if (!context) return;
      const { user } = context;

      const childId = Number(req.query.childId);
      const month = req.query.month;
      if (!Number.isInteger(childId) || typeof month !== 'string' || !/^\d{4}-\d{2}$/.test(month)) {
        return res.status(400).json({ error: 'childId and month (YYYY-MM) are required' });
      }

      const childIds = await accessibleChildIds(user);
      if (!canActOnChild(childIds, childId)) {
        return res.status(403).json({ error: 'Unauthorized' });
      }

      const { from, to } = monthBounds(month);
      const [reservations, records, contract] = await Promise.all([
        storage.getReservations(user.daycareId!, from, to, [childId]),
        storage.getAttendanceRecords(user.daycareId!, from, to, [childId]),
        storage.getContractCoveringDate(childId, user.daycareId!, from),
      ]);

      const reservedTotal = reservations.reduce(
        (total, reservation) => total + reservedMinutes(reservation.startTime, reservation.endTime),
        0,
      );
      const realisedTotal = realisedMinutes(records);
      const contractMinutes = contract ? contract.monthlyHours * 60 : null;

      await logAudit(user.id, user.role, user.daycareId!, 'VIEW', 'care_time_summary');
      res.json({
        childId,
        month,
        reservedMinutes: reservedTotal,
        realisedMinutes: realisedTotal,
        contractMonthlyHours: contract?.monthlyHours ?? null,
        // Positive means the allowance still has room; negative means it is exceeded.
        remainingMinutes: contractMinutes === null ? null : contractMinutes - realisedTotal,
        openRecords: records.filter((record) => record.checkOutAt === null).length,
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to build summary' });
    }
  });

  app.get('/api/care-time/contracts/:childId', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const context = await careTimeContext(req, res);
      if (!context) return;
      const { user } = context;

      const childId = parseInt(req.params.childId);
      if (Number.isNaN(childId)) return res.status(400).json({ error: 'Invalid request' });

      const childIds = await accessibleChildIds(user);
      if (!canActOnChild(childIds, childId)) {
        return res.status(403).json({ error: 'Unauthorized' });
      }

      res.json(await storage.getChildContracts(childId, user.daycareId!));
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch contracts' });
    }
  });

  app.post('/api/care-time/contracts', authenticateToken, async (req: AuthRequest, res: Response) => {
    try {
      const context = await careTimeContext(req, res);
      if (!context) return;
      const { user } = context;

      // What was agreed with the family, so the leader records it.
      if (user.role !== 'daycareleader') {
        return res.status(403).json({ error: 'Only administrators can record contracts' });
      }

      const validatedData = insertChildContractSchema.parse(req.body);

      const children = await storage.getChildren(user.daycareId!);
      if (!children.some((child) => child.id === validatedData.childId)) {
        return res.status(403).json({ error: 'Unauthorized' });
      }

      const created = await storage.createChildContract({
        ...validatedData,
        daycareId: user.daycareId!,
        createdById: user.id,
      });

      await logAudit(user.id, user.role, user.daycareId!, 'CREATE', 'child_contract', created.id);
      res.json(created);
    } catch (error) {
      res.status(400).json({ error: 'Invalid request' });
    }
  });

  /**
   * A deliberate failure, for checking once that alerts actually arrive.
   *
   * Off unless ERROR_REPORTING_TEST_ROUTE is set, because an endpoint that
   * throws on request is a denial-of-service handle if it is left reachable.
   * Turn it on in staging, call it once, confirm the email, turn it off.
   *
   * The message carries fake personal data on purpose: the alert that arrives
   * is then also the evidence that scrubbing works, in the real pipeline rather
   * than in a test.
   */
  if (process.env.ERROR_REPORTING_TEST_ROUTE === 'true') {
    app.get('/api/debug/trigger-error', authenticateToken, async (req: AuthRequest, res: Response) => {
      const user = req.user!;
      if (user.role !== 'daycareleader' && user.role !== 'super_admin') {
        return res.status(403).json({ error: 'Unauthorized' });
      }
      throw new Error(
        "Deliberate test error. If any of this reaches Sentry, scrubbing is broken: " +
        "Key (email)=(testi.vanhempi@esimerkki.invalid) already exists, " +
        "child 'Testi Testilainen', hetu 010190-123A, phone 0401234567",
      );
    });
  }

  const httpServer = createServer(app);

  return httpServer;
}
