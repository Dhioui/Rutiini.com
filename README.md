# Rutiini

Multi-tenant early childhood education management for Finnish municipalities.
Brings a daycare, its staff and guardians into one service: child records, daily
entries, absences, trips and permissions, messaging, documents, forms and meal
menus — in six languages, GDPR-first.

- **Web** — React + Vite
- **API** — Express + TypeScript
- **Database** — PostgreSQL via Drizzle ORM
- **Mobile** — iOS and Android via Capacitor

## Requirements

- Node.js 20+
- PostgreSQL 14+ (any server: managed, container, or on-premises)

## Quick start

```bash
cp .env.example .env          # set DATABASE_URL and JWT_SECRET
npm install
npm run db:push               # create the schema
npx tsx server/seed.ts        # optional: demo municipality, daycares and users
npm run dev                   # http://localhost:5000
```

`JWT_SECRET` must be generated per environment:

```bash
openssl rand -base64 48
```

The server **refuses to start in production** without it, rather than falling back
to a shared default that would let anyone forge a session for any user.

## Running with Docker

Brings up the application and its database together — nothing else required:

```bash
cp .env.example .env          # set JWT_SECRET and POSTGRES_PASSWORD
docker compose up -d
docker compose exec app npm run db:push
```

## Deploying

The application is a single Node process that serves both the API and the built
web client on one port, so it runs anywhere Node runs: a container platform, a
VM behind nginx, or a PaaS.

```bash
npm ci
npm run build
NODE_ENV=production node dist/index.js
```

### Database

`DATABASE_URL` accepts any PostgreSQL connection string. The driver is chosen from
the hostname: `*.neon.tech` uses Neon's WebSocket driver, everything else connects
over ordinary TCP. Override with `DATABASE_DRIVER=neon|postgres` if needed.

**On an existing database, apply the performance indexes once:**

```bash
psql "$DATABASE_URL" -f scripts/add-indexes.sql
```

It uses `CREATE INDEX CONCURRENTLY`, so it takes no table locks and causes no
downtime. It is idempotent and safe to re-run. Do **not** pass `-1` or
`--single-transaction` — `CONCURRENTLY` cannot run inside a transaction. A new
database created with `npm run db:push` already has these indexes.

### Running more than one instance

Instances are stateless and can be scaled horizontally behind a load balancer.
Two things are worth knowing:

- The nightly jobs (meal menu scrape at 03:00, GDPR retention cleanup at 02:00,
  Europe/Helsinki) are guarded by a PostgreSQL advisory lock, so exactly one
  instance runs them however many are up.
- Rate limit counters and the public response cache are per instance. Effective
  limits scale with instance count; the cache holds only public, non-personal
  data with a five-minute TTL, matching the `Cache-Control` those endpoints send.

Set `DATABASE_POOL_MAX` so that instances × pool size stays under the server's
`max_connections`.

### Health checks

| Endpoint | Purpose |
|---|---|
| `/api/health` | Full status including database connectivity |
| `/healthz` | Liveness |
| `/readyz` | Readiness |
| `/livez` | Liveness |

## Configuration

Every variable is documented in [`.env.example`](.env.example). Only
`DATABASE_URL` and `JWT_SECRET` are required. Notable groups:

- `RATE_LIMIT_*` — authenticated requests are counted **per signed-in user**, so a
  daycare behind one public IP address does not share a single budget. Only
  anonymous traffic is counted per IP.
- `RETENTION_*` — how long audit logs, messages, trips, absences, notifications
  and daily entries are kept before the nightly job deletes them. Set these to
  match the retention period agreed in the data processing agreement.

## Data protection

- **Tenant isolation.** Every query is scoped by `daycareId`. Staff see only their
  own daycare's children; guardians see only their own children.
- **Consent.** Children have no accounts and cannot sign in — they exist only as
  records. Only a guardian can grant or withdraw consent, and only for a child
  they are linked to. Staff and daycare leaders cannot consent on a child's behalf.
- **Super admin** can read anonymised statistics only; personal data endpoints
  return 403.
- **Audit log** records access and changes without storing personal data.
- **Retention** is enforced nightly and is configurable per deployment.
- **Subject access requests** (`/api/gdpr/export`) and deletion requests are
  deliberately exempt from the list row caps, so an export is always complete.

## Development

```bash
npm run dev      # dev server with HMR
npm run check    # TypeScript
npx vitest run   # tests
npm run build    # production build
```

Tests cover authentication, authorisation, validation, query shaping and
translation completeness, and need no database.

## Project layout

```
client/     React application
  src/i18n.ts   all six languages
server/     Express API
  routes.ts     HTTP endpoints
  storage.ts    data access
  auth.ts       hashing, tokens, permissions
  rateLimit.ts  request budgets
  db.ts         connection, cache, advisory locks
shared/     schema.ts -- database schema and validation, used by both sides
scripts/    add-indexes.sql -- index migration for existing databases
android/    Capacitor Android project
ios/        Capacitor iOS project
```

## Licence

Proprietary. © Rutiini Software Oy.
