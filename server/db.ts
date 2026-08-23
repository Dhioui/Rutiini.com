import { Pool as NeonPool, neonConfig } from '@neondatabase/serverless';
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-serverless';
import { Pool as PgPool } from 'pg';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import ws from "ws";
import * as schema from "@shared/schema";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const DATABASE_URL = process.env.DATABASE_URL;

const POOL_SETTINGS = {
  max: Number.parseInt(process.env.DATABASE_POOL_MAX ?? '20', 10),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
};

/**
 * Pick the database driver.
 *
 * Neon's serverless driver talks to Neon over a WebSocket and cannot connect to an
 * ordinary PostgreSQL server, so hardcoding it meant the application could only ever
 * run against Neon. A municipality that requires the data in its own infrastructure,
 * a self-hosted deployment and the local development database all need plain
 * PostgreSQL over TCP.
 *
 * The host in DATABASE_URL decides, which is right in every normal case. Set
 * DATABASE_DRIVER to 'neon' or 'postgres' to override it.
 */
function selectDriver(url: string): 'neon' | 'postgres' {
  const override = process.env.DATABASE_DRIVER?.trim().toLowerCase();
  if (override === 'neon' || override === 'postgres') return override;
  if (override) {
    throw new Error(`DATABASE_DRIVER must be 'neon' or 'postgres', got '${override}'`);
  }

  try {
    const host = new URL(url).hostname;
    return host.endsWith('.neon.tech') ? 'neon' : 'postgres';
  } catch {
    throw new Error('DATABASE_URL is not a valid connection URL');
  }
}

export const databaseDriver = selectDriver(DATABASE_URL);

/**
 * Both pools expose the parts used here -- query(), connect() and release() -- so
 * withAdvisoryLock and Drizzle work the same either way.
 */
export const pool = databaseDriver === 'neon'
  ? (neonConfig.webSocketConstructor = ws, new NeonPool({ connectionString: DATABASE_URL, ...POOL_SETTINGS }))
  : new PgPool({ connectionString: DATABASE_URL, ...POOL_SETTINGS });

export const db = databaseDriver === 'neon'
  ? drizzleNeon({ client: pool as NeonPool, schema })
  : drizzlePg({ client: pool as PgPool, schema });

/**
 * Run `fn` only if no other instance is already running the job identified by `key`.
 *
 * The deployment target is autoscale, so every instance boots the same cron
 * schedule and would otherwise run the nightly jobs concurrently -- N menu scrapes
 * against the same external source, and N overlapping retention deletes. A Postgres
 * advisory lock gives mutual exclusion across instances without any extra service.
 *
 * The lock is session-scoped, so it is taken on one connection that is held for the
 * duration of the job and released in a finally block. If an instance dies mid-job
 * the connection drops and the lock is released automatically; both nightly jobs are
 * safe to repeat, so that is the behaviour we want.
 *
 * Returns true if the job ran here, false if another instance held the lock.
 */
/**
 * The subset of a pooled client this function needs. Both drivers provide it, but
 * their overload signatures differ enough that the union cannot be called directly.
 */
interface LockClient {
  query(text: string, values: unknown[]): Promise<{ rows: Array<Record<string, unknown>> }>;
  release(): void;
}

export async function withAdvisoryLock(key: number, fn: () => Promise<void>): Promise<boolean> {
  const client = (await pool.connect()) as unknown as LockClient;
  let acquired = false;
  try {
    const result = await client.query('SELECT pg_try_advisory_lock($1) AS locked', [key]);
    acquired = result.rows[0]?.locked === true;
    if (!acquired) {
      return false;
    }
    await fn();
    return true;
  } finally {
    if (acquired) {
      try {
        await client.query('SELECT pg_advisory_unlock($1)', [key]);
      } catch {
        // The connection is being discarded anyway; the lock dies with the session.
      }
    }
    client.release();
  }
}

/** Advisory lock keys. Arbitrary but must stay stable and distinct across deploys. */
export const LOCK_KEYS = {
  menuScrape: 4711001,
  dataRetention: 4711002,
} as const;

/**
 * Process-local response cache for public, non-personal lookups.
 *
 * Scope, deliberately: this is per instance, and the deployment runs several.
 * invalidateCache() therefore only clears the instance that handled the write, and
 * other instances keep their copy until it expires. That is acceptable here because
 * the endpoints using this cache also send `Cache-Control: public, max-age=300`, so
 * browsers and any CDN in front already tolerate the same five minutes of staleness.
 * Do not put anything in here that must be consistent across instances, or anything
 * user-specific -- entries are shared by every caller hitting this instance.
 */
const CACHE_MAX_ENTRIES = 500;

const cache = new Map<string, { data: any; expiry: number }>();

export function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiry) {
    cache.delete(key);
    return null;
  }
  // Re-insert so iteration order tracks recency, which makes the eviction in
  // setCache drop the least recently read entry rather than an arbitrary one.
  cache.delete(key);
  cache.set(key, entry);
  return entry.data as T;
}

export function setCache(key: string, data: any, ttlMs: number = 60000): void {
  // Cache keys can embed request input (for example ?municipality=), so an unbounded
  // map would grow with the number of distinct values anyone cares to send. Evicting
  // the least recently used entry keeps the memory ceiling fixed.
  if (!cache.has(key) && cache.size >= CACHE_MAX_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey !== undefined) {
      cache.delete(oldestKey);
    }
  }
  cache.set(key, { data, expiry: Date.now() + ttlMs });
}

export function invalidateCache(pattern?: string): void {
  if (!pattern) {
    cache.clear();
    return;
  }
  const keys = Array.from(cache.keys());
  for (const key of keys) {
    if (key.includes(pattern)) {
      cache.delete(key);
    }
  }
}

const cacheSweep = setInterval(() => {
  const now = Date.now();
  const entries = Array.from(cache.entries());
  for (const [key, entry] of entries) {
    if (now > entry.expiry) {
      cache.delete(key);
    }
  }
}, 60000);

// Don't hold the process open for the sweep alone.
cacheSweep.unref();
