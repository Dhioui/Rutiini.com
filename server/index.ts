import express from "express";
import helmet from "helmet";
import cors from "cors";
import compression from "compression";
import cron from "node-cron";
import { registerRoutes } from "./routes";
import { serveStatic, log } from "./static";
import { fetchAndSaveMenu, fetchAndSaveMenuForDaycare } from "./menuScraper";
import { storage } from "./storage";
import { withAdvisoryLock, LOCK_KEYS } from "./db";
import { assertEmailConfigured } from "./email";
import { corsOrigin } from "./cors";
import { createErrorHandler } from "./errorHandler";
import { errorReportingEnabled } from "./errorReporting";
import {
  apiLimiter,
  authLimiter,
  passwordResetLimiter,
  publicApiLimiter,
} from "./rateLimit";

// Refuse to start a production deployment that cannot send password reset email.
// Without it everything looks healthy until the first person forgets their password
// and finds there is no way back into their account.
assertEmailConfigured();

const app = express();

// Trust proxy for proper IP detection
// Always set to 1 for rate limiting to work correctly with X-Forwarded-For headers
app.set('trust proxy', 1);

// Compress responses before they leave the process. JSON list endpoints are highly
// repetitive and typically shrink by an order of magnitude, which matters most on the
// mobile clients where bandwidth, not server CPU, is the limiting factor.
app.use(compression());

// Security middleware
// CSRF Protection: Not required for JWT-based authentication because:
// 1. JWTs are stored in localStorage/sessionStorage, not cookies
// 2. JWTs must be explicitly added to Authorization headers by JavaScript
// 3. Attackers cannot read localStorage due to Same-Origin Policy
// 4. Cross-origin requests cannot include the JWT without explicit JavaScript access
const isDevelopment = process.env.NODE_ENV === 'development';

app.use(helmet({
  contentSecurityPolicy: isDevelopment ? false : {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      connectSrc: ["'self'", "https://*.neon.tech", "wss:", "ws:"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
    },
  },
}));
app.use(cors({
  origin: corsOrigin(process.env.CORS_ORIGIN),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));


app.use('/api/public', publicApiLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/reset-password', passwordResetLimiter);
app.use('/api', apiLimiter);

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown
  }
}

app.use(express.json({
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: false }));

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Request logging.
//
// This previously wrapped res.json to keep a reference to every response body and
// then JSON.stringify'd it on finish, only to truncate the result to 80 characters.
// That meant a second full serialisation of every payload -- on a list endpoint
// returning hundreds of rows, the logger cost more than the handler. Response bodies
// are no longer captured: they are the request's largest object, they may contain
// personal data that does not belong in logs, and the line was truncated anyway.
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;

  res.on("finish", () => {
    if (!path.startsWith("/api")) {
      return;
    }
    const duration = Date.now() - start;
    log(`${req.method} ${path} ${res.statusCode} in ${duration}ms`);
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use(createErrorHandler(log));

  log(
    errorReportingEnabled()
      ? '[Errors] Reporting to Sentry is on'
      : '[Errors] Reporting is off (SENTRY_DSN unset) -- failures are logged here only',
  );

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    // Imported here rather than at the top of the file. ./vite pulls in Vite,
    // vite.config and nanoid, which are devDependencies and are absent from the
    // runtime image; a static import would be resolved before any of this code
    // ran, so the check guarding it would never be reached. Kept out of the
    // production bundle by esbuild's --splitting.
    const { setupVite } = await import("./vite");
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
    
    // Schedule menu scraping daily at 03:00 (Helsinki time)
    cron.schedule('0 3 * * *', async () => {
      // Guarded so only one instance scrapes, however many are running.
      const ran = await withAdvisoryLock(LOCK_KEYS.menuScrape, async () => {
        log('[Cron] Starting daily menu scrape for all Aromi daycares...');
        try {
          // Get all daycares with menu_source_type='aromi'
          const aromidaycares = await storage.getDaycaresByMenuSource('aromi');
        
          if (aromidaycares.length === 0) {
            log('[Cron] No daycares with Aromi menu source configured');
            return;
          }
        
          log(`[Cron] Found ${aromidaycares.length} daycares with Aromi source`);
        
          // Fetch menu for each daycare
          for (const daycare of aromidaycares) {
            try {
              const result = await fetchAndSaveMenuForDaycare(daycare.id, daycare.menuSourceUrl || undefined);
              log(`[Cron] Daycare ${daycare.name} (${daycare.id}): ${result.message}`);
            } catch (error: any) {
              log(`[Cron] Daycare ${daycare.name} (${daycare.id}) failed: ${error.message}`);
            }
          }
        
          log('[Cron] Menu scrape complete for all daycares');
        } catch (error: any) {
          log(`[Cron] Menu scrape failed: ${error.message}`);
        }
      });
      if (!ran) {
        log('[Cron] Menu scrape already running on another instance, skipped');
      }
    }, {
      timezone: 'Europe/Helsinki'
    });
    log('[Cron] Menu scraper scheduled for 03:00 daily');
    
    // GDPR Data Retention cron job - runs at 02:00 daily (before menu scraping)
    // Configurable via environment variables (defaults: audit 12mo, messages 12mo, trips 12mo, absences 24mo)
    cron.schedule('0 2 * * *', async () => {
      // Guarded so only one instance performs the retention deletes.
      const ran = await withAdvisoryLock(LOCK_KEYS.dataRetention, async () => {
        log('[Cron] Starting GDPR data retention cleanup...');
        try {
          const AUDIT_RETENTION_MONTHS = parseInt(process.env.RETENTION_AUDIT_MONTHS || '12', 10);
          const MESSAGES_RETENTION_MONTHS = parseInt(process.env.RETENTION_MESSAGES_MONTHS || '12', 10);
          const TRIPS_RETENTION_MONTHS = parseInt(process.env.RETENTION_TRIPS_MONTHS || '12', 10);
          const ABSENCES_RETENTION_MONTHS = parseInt(process.env.RETENTION_ABSENCES_MONTHS || '24', 10);
          const NOTIFICATIONS_RETENTION_MONTHS = parseInt(process.env.RETENTION_NOTIFICATIONS_MONTHS || '6', 10);
          const ENTRIES_RETENTION_MONTHS = parseInt(process.env.RETENTION_ENTRIES_MONTHS || '24', 10);
          // Care time feeds billing, which is reconciled long after the fact, so
          // these default to longer than the operational records above.
          const RESERVATIONS_RETENTION_MONTHS = parseInt(process.env.RETENTION_RESERVATIONS_MONTHS || '36', 10);
          const ATTENDANCE_RETENTION_MONTHS = parseInt(process.env.RETENTION_ATTENDANCE_MONTHS || '36', 10);
        
          // Cleanup audit logs
          const auditLogsDeleted = await storage.cleanupOldAuditLogs(AUDIT_RETENTION_MONTHS);
          log(`[Cron] Audit logs deleted: ${auditLogsDeleted} (retention: ${AUDIT_RETENTION_MONTHS} months)`);
        
          // Cleanup messages
          const messagesDeleted = await storage.cleanupOldMessages(MESSAGES_RETENTION_MONTHS);
          log(`[Cron] Messages deleted: ${messagesDeleted} (retention: ${MESSAGES_RETENTION_MONTHS} months)`);
        
          // Cleanup trips and responses
          const tripsDeleted = await storage.cleanupOldTrips(TRIPS_RETENTION_MONTHS);
          log(`[Cron] Trips deleted: ${tripsDeleted} (retention: ${TRIPS_RETENTION_MONTHS} months)`);
        
          // Cleanup absences
          const absencesDeleted = await storage.cleanupOldAbsences(ABSENCES_RETENTION_MONTHS);
          log(`[Cron] Absences deleted: ${absencesDeleted} (retention: ${ABSENCES_RETENTION_MONTHS} months)`);
        
          // Cleanup notifications
          const notificationsDeleted = await storage.cleanupOldNotifications(NOTIFICATIONS_RETENTION_MONTHS);
          log(`[Cron] Notifications deleted: ${notificationsDeleted} (retention: ${NOTIFICATIONS_RETENTION_MONTHS} months)`);
        
          // Cleanup daily entries
          const entriesDeleted = await storage.cleanupOldEntries(ENTRIES_RETENTION_MONTHS);
          log(`[Cron] Entries deleted: ${entriesDeleted} (retention: ${ENTRIES_RETENTION_MONTHS} months)`);
        
          // Cleanup care time reservations
          const reservationsDeleted = await storage.cleanupOldReservations(RESERVATIONS_RETENTION_MONTHS);
          log(`[Cron] Reservations deleted: ${reservationsDeleted} (retention: ${RESERVATIONS_RETENTION_MONTHS} months)`);

          // Cleanup realised attendance records
          const attendanceDeleted = await storage.cleanupOldAttendanceRecords(ATTENDANCE_RETENTION_MONTHS);
          log(`[Cron] Attendance records deleted: ${attendanceDeleted} (retention: ${ATTENDANCE_RETENTION_MONTHS} months)`);

          // Cleanup expired session tokens
          const expiredTokens = await storage.deleteExpiredSessionTokens();
          log(`[Cron] Expired session tokens deleted: ${expiredTokens}`);
        
          log('[Cron] GDPR data retention cleanup complete');
        } catch (error: any) {
          log(`[Cron] Data retention cleanup failed: ${error.message}`);
        }
      });
      if (!ran) {
        log('[Cron] Data retention already running on another instance, skipped');
      }
    }, {
      timezone: 'Europe/Helsinki'
    });
    log('[Cron] GDPR data retention scheduled for 02:00 daily');
  });
})();
