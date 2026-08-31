/**
 * Error reporting to Sentry, built by hand rather than with the SDK.
 *
 * The reason is one sentence: you cannot leak what you never collect. An SDK
 * gathers the request URL, its query string, headers, the body, earlier requests
 * as breadcrumbs and the signed-in user, and in this application every one of
 * those can carry a child's or a guardian's data. Turning each of them off works
 * until a version adds a source nobody switched off.
 *
 * So the payload is assembled field by field below. Anything not listed here is
 * not sent, including anything a future change starts producing.
 *
 * Everything except the transport is a pure function, so what is redacted can be
 * tested without a network.
 */

/** Sent only when a DSN is configured. Unset, every call here does nothing. */
const DSN = process.env.SENTRY_DSN;

const MAX_MESSAGE_LENGTH = 1000;
const MAX_FRAMES = 30;

/**
 * Removes the things an error message is known to quote back.
 *
 * Deliberately over-redacts. A message reading "duplicate key ... Key (email)=
 * ([redacted])" is still enough to find the bug, and the alternative is a
 * guardian's address sitting in a third party's issue tracker.
 */
export function scrubText(text: string): string {
  return text
    // PostgreSQL quotes the offending row: Key (email)=(anna@example.fi)
    .replace(/(Key\s*\([^)]*\)\s*=\s*\()[^)]*(\))/gi, '$1[redacted]$2')
    // Anything the database or a driver put in single quotes is a value.
    .replace(/'[^']*'/g, "'[redacted]'")
    .replace(/\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g, '[email]')
    // Finnish personal identity code: 010190-123A, 010100A123B.
    .replace(/\b\d{6}[-+A]\d{3}[0-9A-Y]\b/gi, '[hetu]')
    // JWTs and similar bearer material.
    .replace(/\beyJ[\w-]{10,}\.[\w-]+\.?[\w-]*/g, '[token]')
    // Long digit runs: phone numbers, account numbers, identifiers.
    .replace(/\b\d{7,}\b/g, '[number]')
    .slice(0, MAX_MESSAGE_LENGTH);
}

/**
 * The shape of a path rather than the path itself.
 *
 * `/api/children/100/entries` becomes `/api/children/:id/entries`. The number was
 * a child, and a child id is a pseudonymous identifier: on its own it names a
 * person to anyone holding the database. The template is what groups errors
 * anyway, so nothing operational is lost.
 *
 * Non-numeric segments are kept. The one that identifies anything is a daycare
 * code, which is an organisation rather than a person, and knowing which daycare
 * is failing is the point of the alert.
 */
export function routeTemplate(path: string): string {
  return path
    .split('/')
    .map((segment) => {
      if (/^\d+$/.test(segment)) return ':id';
      if (/^\d{4}-\d{2}-\d{2}$/.test(segment)) return ':date';
      if (/^\d{4}-\d{2}$/.test(segment)) return ':month';
      return segment;
    })
    .join('/');
}

interface StackFrame {
  filename: string;
  function: string;
  lineno: number;
}

/**
 * Turns a stack string into frames so Sentry can group by them.
 *
 * File paths and function names are code, not data, so they pass through. Frames
 * are capped because a runaway recursion would otherwise send thousands.
 */
export function parseStack(stack: string | undefined): StackFrame[] {
  if (!stack) return [];

  return stack
    .split('\n')
    .map((line) => /^\s*at\s+(?:(.+?)\s+\()?(.+?):(\d+):\d+\)?$/.exec(line.trim()))
    .filter((match): match is RegExpExecArray => match !== null)
    .slice(0, MAX_FRAMES)
    .map((match) => ({
      function: match[1] ?? '<anonymous>',
      filename: match[2],
      lineno: Number(match[3]),
    }))
    // Sentry renders the innermost frame last.
    .reverse();
}

export interface ErrorContext {
  method: string;
  path: string;
  status: number;
  /** Role only. Never the user's id, name or email address. */
  role?: string;
  /** Which daycare hit it, so an alert can be acted on. An organisation, not a person. */
  daycareId?: number | null;
}

/**
 * The complete outgoing payload.
 *
 * Written as one object literal on purpose: everything Sentry receives is
 * visible here in twenty lines, and a reviewer can confirm what is absent as
 * easily as what is present. There is no request body, no query string, no
 * headers, no cookies, no breadcrumbs and no user identity.
 */
export function buildErrorEvent(error: unknown, context: ErrorContext, now = new Date()) {
  const asError = error instanceof Error ? error : undefined;

  return {
    event_id: randomEventId(),
    timestamp: now.toISOString(),
    platform: 'node',
    level: 'error',
    logger: 'rutiini',
    environment: process.env.NODE_ENV ?? 'development',
    release: process.env.APP_VERSION,
    exception: {
      values: [
        {
          type: asError?.name ?? 'Error',
          value: scrubText(asError?.message ?? String(error)),
          stacktrace: { frames: parseStack(asError?.stack) },
        },
      ],
    },
    tags: {
      route: routeTemplate(context.path),
      method: context.method,
      status: String(context.status),
      role: context.role ?? 'anonymous',
      daycare: context.daycareId != null ? String(context.daycareId) : 'none',
    },
  };
}

function randomEventId(): string {
  // 32 hex characters, which is what Sentry expects.
  return Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}

/** Splits a DSN into the pieces the ingest URL and auth header need. */
export function parseDsn(dsn: string): { url: string; key: string } | null {
  const match = /^https:\/\/([^@]+)@([^/]+)\/(\d+)$/.exec(dsn.trim());
  if (!match) return null;
  return { url: `https://${match[2]}/api/${match[3]}/envelope/`, key: match[1] };
}

/**
 * Sends the event, and never lets reporting break the request that caused it.
 *
 * Not awaited by the caller and swallows its own failures: an error report that
 * throws would replace a handled 500 with an unhandled one, and Sentry being
 * unreachable is not a reason for the application to behave differently.
 */
export function reportError(error: unknown, context: ErrorContext): void {
  if (!DSN) return;

  const target = parseDsn(DSN);
  if (!target) return;

  const event = buildErrorEvent(error, context);
  const envelope = [
    JSON.stringify({ event_id: event.event_id, sent_at: event.timestamp }),
    JSON.stringify({ type: 'event' }),
    JSON.stringify(event),
  ].join('\n');

  void fetch(target.url, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-sentry-envelope',
      'x-sentry-auth': `Sentry sentry_version=7, sentry_key=${target.key}, sentry_client=rutiini/1.0`,
    },
    body: envelope,
    signal: AbortSignal.timeout(5000),
  }).catch(() => {
    // Deliberately silent. Logging a failed report on every request during a
    // Sentry outage would bury the errors this exists to surface.
  });
}

/** True when reporting is configured, for the startup log and the health check. */
export function errorReportingEnabled(): boolean {
  return Boolean(DSN && parseDsn(DSN));
}
