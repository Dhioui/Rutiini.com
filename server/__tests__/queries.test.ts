/**
 * Tests for the query-shaping changes made for scale:
 *  - the row caps applied to list endpoints and the clamping of caller-supplied ?limit
 *  - the safety property that makes the guard in deleteDaycare necessary
 *
 * These do not touch a database. Drizzle can render a statement with .toSQL(),
 * which is enough to assert the shape of the SQL we generate.
 */

import { describe, it, expect } from 'vitest';
import type { Request } from 'express';
import { or, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { sessionTokens } from '@shared/schema';
import { LIST_LIMITS, MAX_LIST_LIMIT, readPagination } from '../pagination';

const makeReq = (query: Record<string, unknown>) => ({ query }) as unknown as Request;

describe('list row caps', () => {
  it('defines a positive default for every capped list', () => {
    for (const [name, limit] of Object.entries(LIST_LIMITS)) {
      expect(limit, name).toBeGreaterThan(0);
    }
  });

  it('keeps every default at or below the hard ceiling', () => {
    for (const [name, limit] of Object.entries(LIST_LIMITS)) {
      expect(limit, name).toBeLessThanOrEqual(MAX_LIST_LIMIT);
    }
  });
});

describe('readPagination', () => {
  it('falls back to the endpoint default when no limit is given', () => {
    expect(readPagination(makeReq({}), LIST_LIMITS.entries)).toEqual({
      limit: LIST_LIMITS.entries,
      offset: 0,
    });
  });

  it('honours a caller-supplied limit and offset', () => {
    expect(readPagination(makeReq({ limit: '25', offset: '50' }), LIST_LIMITS.entries)).toEqual({
      limit: 25,
      offset: 50,
    });
  });

  it('clamps a limit above the hard ceiling', () => {
    const { limit } = readPagination(makeReq({ limit: '999999' }), LIST_LIMITS.entries);
    expect(limit).toBe(MAX_LIST_LIMIT);
  });

  it('ignores non-numeric, zero and negative values rather than passing them to SQL', () => {
    for (const bad of ['abc', '0', '-5', '', 'NaN']) {
      const { limit, offset } = readPagination(
        makeReq({ limit: bad, offset: bad }),
        LIST_LIMITS.entries
      );
      expect(limit, `limit for ${JSON.stringify(bad)}`).toBe(LIST_LIMITS.entries);
      expect(offset, `offset for ${JSON.stringify(bad)}`).toBe(0);
    }
  });

  it('ignores a repeated query parameter instead of trusting the array', () => {
    const { limit } = readPagination(makeReq({ limit: ['10', '20'] }), LIST_LIMITS.entries);
    expect(limit).toBe(LIST_LIMITS.entries);
  });
});

describe('delete guard', () => {
  const db = drizzle({} as any);

  // This is the behaviour deleteDaycare has to defend against: when every term of an
  // or() is undefined, or() itself is undefined, and Drizzle renders .where(undefined)
  // as no WHERE clause at all -- an unconditional delete of the whole table. If a
  // Drizzle upgrade ever changes this, this test fails and the guard can be revisited.
  it('renders .where(undefined) as an unconditional delete', () => {
    expect(or(undefined, undefined)).toBeUndefined();
    const sql = db.delete(sessionTokens).where(or(undefined, undefined)).toSQL().sql;
    expect(sql.toLowerCase()).not.toContain('where');
  });

  it('renders a real condition with a where clause', () => {
    const sql = db.delete(sessionTokens).where(eq(sessionTokens.userId, 1)).toSQL().sql;
    expect(sql.toLowerCase()).toContain('where');
  });
});
