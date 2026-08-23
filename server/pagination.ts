import type { Request } from "express";

/**
 * Default row caps for list queries.
 *
 * These queries previously returned every matching row, so a daycare with a year
 * of history could pull tens of thousands of records into memory to render one
 * screen. Each cap sits far above what any view actually displays, and callers
 * that need more can page through with the limit/offset arguments.
 *
 * Date-ranged queries (getEntriesByDateRange, getAbsencesByDateRange) are already
 * bounded by their range and are intentionally left uncapped so CSV exports stay
 * complete, as are the queries backing a GDPR subject access request.
 */
export const LIST_LIMITS = {
  children: 1000,
  entries: 500,
  trips: 200,
  absences: 500,
  messages: 200,
  notifications: 100,
} as const;

/** Hard ceiling for a caller-supplied ?limit, to keep one request from scanning a whole table. */
export const MAX_LIST_LIMIT = 1000;

/**
 * Read optional ?limit / ?offset from a request.
 *
 * List endpoints still return a plain array, so existing clients are unaffected;
 * these parameters let a caller page through results instead of relying on the
 * server default. limit is clamped to MAX_LIST_LIMIT so no single request can be
 * made to scan an entire table.
 *
 * A repeated query parameter arrives as an array rather than a string; parseInt
 * would coerce it in ways the caller did not intend, so anything that does not
 * parse to a positive integer falls back to the default.
 */
export function readPagination(
  req: Request,
  defaultLimit: number
): { limit: number; offset: number } {
  const rawLimit = typeof req.query.limit === "string" ? Number.parseInt(req.query.limit, 10) : NaN;
  const rawOffset = typeof req.query.offset === "string" ? Number.parseInt(req.query.offset, 10) : NaN;

  const limit = Number.isFinite(rawLimit) && rawLimit > 0
    ? Math.min(rawLimit, MAX_LIST_LIMIT)
    : defaultLimit;
  const offset = Number.isFinite(rawOffset) && rawOffset > 0 ? rawOffset : 0;

  return { limit, offset };
}
