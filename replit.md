# Rutiini - Multi-Tenant Daycare Management System

## Overview
Rutiini (rutiini.com) is a comprehensive full-stack multi-tenant daycare management system designed to streamline operations, enhance communication, and provide secure, role-based access for daycares, staff, and guardians. The system ensures complete data isolation between daycares while offering robust features for child management, daily activity tracking, communication, and administration. It aims to modernize daycare administration by centralizing information and facilitating secure interactions between all stakeholders.

**Deployment Targets:**
- Website: rutiini.com
- iOS: Apple App Store (via Capacitor)
- Android: Google Play Store (via Capacitor)

## User Preferences
- Iterative development with detailed explanations
- Ask before making major changes
- Self-hosting planned for long-term ownership
- Single codebase for web, iOS, and Android

## System Architecture

### UI/UX Decisions
- **Color Scheme**: Primary blue (`#2563eb`).
- **Typography**: Inter font.
- **Components**: Utilizes `shadcn/ui` with `Tailwind CSS` for a modern and responsive design.
- **Layout**: Sidebar navigation.
- **Multi-Language Support**: Full 6-language support with Finnish (fi), English (en), Swedish (sv), Arabic (ar), Russian (ru), and Somali (so). Finnish is the base language with translations to all others. Arabic language includes RTL (right-to-left) support.

### Recent Enhancements (December 4, 2025)
- **Municipality Management System**: Super Admin can manage municipalities via `/super-admin/municipalities`. Municipalities have:
    - Unique code (auto-uppercased) and name
    - Default menu source settings (type + URL) inherited by linked daycares
    - Contact email and active status
    - Full CRUD with Zod validation (updateMunicipalitySchema with strict mode)
- **Municipality-Based Menu Automation**: Menu scraper now:
    - Checks municipality `defaultMenuSourceType` and `defaultMenuSourceUrl` for daycares without own settings
    - Groups daycares by unique source URL to avoid redundant scrapes
    - Efficiently distributes fetched menu to all daycares using same source
- **GDPR Self-Service**: Guardians can request data export and deletion via `/settings/privacy`. Admins can manage deletion requests via `/admin/gdpr`. All requests stored in `gdpr_deletion_requests` table with status tracking.
- **Super Admin Dashboard**: Municipality-based statistics with table/card view toggle. Displays totals row and per-municipality breakdown (children, daycares, users).
- **Audit Log Improvements**: Filtering by action type, entity type, search functionality with active filter display and results count.
- **Kubernetes Health Probes**: `/healthz`, `/livez`, `/readyz` endpoints for container orchestration (200/503 responses).
- **WCAG Accessibility**: Skip-to-content link with focus management, ARIA labels on all utility dropdowns, banner/main landmarks.
- **Collapsible Sidebar Groups**: Role-based menu organization with accessible collapsible groups using Radix UI Collapsible component.
- **CSV Export System**: Daycare leaders can export reports via Dashboard:
    - `/api/export/children` - Child roster with allergies and group
    - `/api/export/entries` - Daily entries with date range filtering
    - `/api/export/absences` - Absence records with reporter info
    - `/api/export/attendance` - Attendance summary per child
    - UTF-8 BOM for Excel compatibility, bulk user fetch (N+1 prevention)
- **DPIA Document**: `/docs/DPIA.md` - Complete Data Protection Impact Assessment:
    - Risk assessment matrix with mitigation measures
    - Controller decision statement and residual risk acceptance
    - GDPR compliance checklist and stakeholder approval section
- **Account Lockout**: 5 failed login attempts triggers 15-minute lockout
- **Session Token Invalidation**: Logout removes token from database (session_tokens table)
- **Automated Data Retention**: Daily CRON job cleans expired data (12-24 months based on type)

### Security Enhancements (December 2, 2025)
- **Content Security Policy (CSP)**: Explicit directives added to Helmet:
    - `scriptSrc: ['self']` - XSS prevention
    - `connectSrc: ['self', 'https://*.neon.tech']` - Safe API connections
    - `imgSrc: ['self', 'data:']` - Image resource restrictions
    - `defaultSrc: ['self']` - Fallback to same-origin
    - Blocks external scripts, embedded objects, and unsafe content

### Technical Implementations
- **Multi-Tenant Architecture**:
    - **Data Isolation**: Each daycare's data is completely isolated using a `daycareId` for all entities.
    - **Three-Step Login**: Daycare code entry, role selection (Admin, Staff, Guardian), then email/password login.
    - **Super Admin**: System-wide administrators can log in without a daycare code via a dedicated route or button, with `daycareId: null`.
    - **Role-Based Access Control (RBAC)**: Fine-grained permissions for Admin, Staff, Guardian, and Super Admin roles.
- **Authentication & Security**:
    - JWT authentication with embedded `daycareId` (CSRF-safe by design).
    - Bcrypt password hashing (10 rounds).
    - Server-side validation of user and `daycareId` to prevent privilege escalation and cross-daycare access.
    - All API endpoints enforce `daycareId` filtering and role-based access.
    - Rate limiting: 100/15min general, 5/15min auth, 3/hour password reset.
    - Helmet security headers (X-Content-Type-Options, X-Frame-Options, X-XSS-Protection).
- **GDPR Compliance (Municipal-Grade)**:
    - **Super Admin Restrictions**: Can ONLY access anonymized statistics - NO personal data access.
    - **Audit Logging**: All CRUD, LOGIN/LOGOUT, and ACCESS_DENIED events logged with hashed entity IDs.
    - **Sanitized Logs**: Audit log API explicitly excludes metadata to prevent PII exposure (IP addresses, etc.).
    - **User Lifecycle**: First-login password change (`passwordNeedsReset` flag), password reset with SHA256-hashed tokens.
    - **Data Isolation**: Complete tenant separation via `daycareId` filtering on all queries.

### Feature Specifications
- **Child Management**: Create and manage child profiles.
- **Daily Entries**: Staff can log sleep, meal, play, and incident entries for children. Quick entry buttons allow one-click recording of common activities (ate well, napping, playing outside, mood).
- **User Management**: Admins and Staff can create guardian and staff accounts and link guardians to children. Super Admins can manage daycares and users across the entire system.
- **Trip Management**: Create trips, track guardian responses (approve/decline).
- **Communication**:
    - **Absences & Illness Reporting**: Guardians can report child absences; Staff/Admin can view.
    - **Messaging System**: Direct chat between staff/admin and guardians, scoped by child context.
    - **Documents & Announcements**: Staff/Admin can publish documents and announcements viewable by all daycare users.
    - **Notification System**: Real-time notifications with unread count badge. Guardians receive alerts for entries, trips, and messages. Staff receive alerts for absences. All notifications are fully translated into 6 languages.
- **Dashboards**: Role-specific dashboards for an overview of activities and statistics.
- **Settings Page**: Version info, GDPR compliance info, changelog, links to privacy policy and terms of service.
- **Health Check Endpoint**: `/api/health` endpoint for production monitoring with database connection validation.
- **Version API**: `/api/version` endpoint returns current version, build number, and environment.
- **Production Security**: Helmet security headers, CORS configuration, rate limiting on auth endpoints, strong password validation (8+ chars with uppercase, lowercase, number, special character).

### System Design Choices
- **Frontend**: React 18 with TypeScript, Wouter for routing, TanStack Query for data fetching.
- **Backend**: Express.js with TypeScript.
- **Database**: PostgreSQL (Neon) with Drizzle ORM for schema management and queries.
- **Project Structure**: Clear separation of `client`, `server`, and `shared` (schema) directories.

### Testing Infrastructure (December 4, 2025)
- **Test Framework**: Vitest with TypeScript support
- **Test Files**: Located in `server/__tests__/`
- **Run Tests**: `npx vitest run`
- **Test Coverage**:
    - `auth.test.ts` (35 tests): Password hashing, JWT tokens, session management, lockout logic
    - `validation.test.ts` (38 tests): Schema validation using Zod (users, children, daycares, entries)
    - `authorization.test.ts` (59 tests): Role-based access, multi-tenant isolation, GDPR restrictions
    - `integration.test.ts` (13 tests): End-to-end auth flows, VAHTI compliance verification
- **Shared Auth Module**: `server/auth.ts` centralizes all authentication/authorization logic:
    - Password: `hashPassword`, `verifyPassword` (bcrypt 10 rounds)
    - Tokens: `generateToken`, `verifyToken` (JWT with 7d expiry)
    - Sessions: `hashSessionToken`, `generateResetToken` (SHA256)
    - Lockout: `isAccountLocked`, `calculateLockoutExpiration` (5 attempts, 15min)
    - Authorization: `canAccessDaycare`, `hasRole`, `canViewChildren`, `canManageDaycares`

## External Dependencies

- **Database**: PostgreSQL (hosted on Neon)
- **Frontend Libraries**:
    - React 18
    - Wouter (for routing)
    - TanStack Query (React Query)
    - Tailwind CSS
    - shadcn/ui
    - i18next (for internationalization)
    - Lucide React (for icons)
- **Backend Libraries**:
    - Express.js
    - Drizzle ORM
    - jsonwebtoken (for JWT authentication)
    - bcrypt (for password hashing)
- **Mobile App Framework**:
    - Capacitor (wraps web app for iOS/Android)
    - See `MOBILE_DEPLOYMENT.md` for App Store/Play Store submission guide