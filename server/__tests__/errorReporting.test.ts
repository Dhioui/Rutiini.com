/**
 * What leaves the server when something breaks.
 *
 * These matter more than most tests here. A wrong answer does not show up as a
 * failure a user reports -- it shows up as a child's name sitting in a third
 * party's issue tracker, discovered by whoever audits the data processing
 * agreement, months later.
 *
 * So the assertions are written the awkward way round: they take a realistic
 * error containing real-looking personal data and check that none of it survives
 * into the payload.
 */

import { describe, it, expect } from 'vitest';
import {
  scrubText,
  routeTemplate,
  parseStack,
  buildErrorEvent,
  parseDsn,
} from '../errorReporting';

describe('Scrubbing an error message', () => {
  it('redacts the row PostgreSQL quotes back on a unique violation', () => {
    const message =
      'duplicate key value violates unique constraint "users_email_unique" ' +
      'Key (email)=(anna.virtanen@esimerkki.fi) already exists.';
    const scrubbed = scrubText(message);

    expect(scrubbed).not.toContain('anna.virtanen');
    expect(scrubbed).not.toContain('esimerkki.fi');
    // The constraint name survives, which is what makes the error diagnosable.
    expect(scrubbed).toContain('users_email_unique');
  });

  it('redacts an email address anywhere in the text', () => {
    expect(scrubText('failed to send to huoltaja@perhe.fi after 3 tries'))
      .toBe('failed to send to [email] after 3 tries');
  });

  it('redacts a Finnish personal identity code in both forms', () => {
    expect(scrubText('lookup failed for 010190-123A')).toContain('[hetu]');
    expect(scrubText('lookup failed for 010100A123B')).toContain('[hetu]');
  });

  it('redacts values the database put in single quotes', () => {
    const scrubbed = scrubText(`invalid input value for enum: 'Aino Virtanen'`);
    expect(scrubbed).not.toContain('Aino');
    expect(scrubbed).toContain('[redacted]');
  });

  it('redacts a bearer token', () => {
    const scrubbed = scrubText('rejected eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.abc.def');
    expect(scrubbed).not.toContain('eyJhbGci');
    expect(scrubbed).toContain('[token]');
  });

  it('redacts a long run of digits, which could be a phone number', () => {
    expect(scrubText('sms to 0401234567 failed')).toBe('sms to [number] failed');
  });

  it('leaves a short number alone, so status codes stay readable', () => {
    expect(scrubText('upstream returned 503 after 2 retries'))
      .toBe('upstream returned 503 after 2 retries');
  });

  it('leaves the application\'s own wording untouched', () => {
    const message = 'Child is not in your daycare';
    expect(scrubText(message)).toBe(message);
  });

  it('truncates a message long enough to be a dumped row', () => {
    expect(scrubText('x'.repeat(5000)).length).toBe(1000);
  });
});

describe('Turning a path into a route', () => {
  it('replaces a child id with a placeholder', () => {
    // The id is pseudonymous: it names a person to anyone holding the database.
    expect(routeTemplate('/api/children/100/entries')).toBe('/api/children/:id/entries');
  });

  it('replaces every id in a path, not only the first', () => {
    expect(routeTemplate('/api/users/12/children/100')).toBe('/api/users/:id/children/:id');
  });

  it('replaces a date and a month', () => {
    expect(routeTemplate('/api/menu/2026-03-04')).toBe('/api/menu/:date');
    expect(routeTemplate('/api/summary/2026-03')).toBe('/api/summary/:month');
  });

  it('keeps a path that has no identifiers in it', () => {
    expect(routeTemplate('/api/care-time/today')).toBe('/api/care-time/today');
  });
});

describe('Parsing a stack', () => {
  const stack = [
    'Error: something failed',
    '    at getChild (/app/server/storage.ts:601:14)',
    '    at /app/server/routes.ts:712:20',
  ].join('\n');

  it('reads file, function and line', () => {
    const frames = parseStack(stack);
    expect(frames).toHaveLength(2);
    // Innermost last, which is the order Sentry renders.
    expect(frames[1]).toEqual({
      function: 'getChild', filename: '/app/server/storage.ts', lineno: 601,
    });
  });

  it('handles a frame with no function name', () => {
    expect(parseStack(stack)[0].function).toBe('<anonymous>');
  });

  it('survives a missing stack', () => {
    expect(parseStack(undefined)).toEqual([]);
  });
});

describe('The whole outgoing payload', () => {
  /** An error carrying every kind of data that must not leave the server. */
  const leakyError = Object.assign(
    new Error(
      'insert failed: Key (email)=(aino.vanhempi@perhe.fi) already exists, ' +
      "child 'Aino Virtanen', hetu 010190-123A, phone 0401234567",
    ),
    { stack: 'Error: x\n    at save (/app/server/storage.ts:10:1)' },
  );

  const event = buildErrorEvent(leakyError, {
    method: 'POST',
    path: '/api/children/100/entries',
    status: 500,
    role: 'staff',
    daycareId: 7,
  });

  const serialised = JSON.stringify(event);

  it('contains none of the personal data the error carried', () => {
    for (const secret of [
      'aino.vanhempi', 'perhe.fi', 'Aino Virtanen', '010190-123A', '0401234567',
    ]) {
      expect(serialised).not.toContain(secret);
    }
  });

  it('carries no child id, even in the route', () => {
    expect(event.tags.route).toBe('/api/children/:id/entries');
    expect(serialised).not.toContain('/100/');
  });

  it('identifies the daycare and the role, and nothing about the person', () => {
    expect(event.tags.daycare).toBe('7');
    expect(event.tags.role).toBe('staff');
    // No field in the payload holds an identity. Asserted on JSON keys rather
    // than on the word: "email" survives inside the message as the name of the
    // column PostgreSQL complained about, which is diagnostic and carries no
    // value -- Key (email)=([redacted]).
    expect(serialised).not.toContain('"userId"');
    expect(serialised).not.toContain('"email"');
    expect(serialised).not.toContain('"user"');
    expect(serialised).toContain('Key (email)=([redacted])');
  });

  it('sends no request body, query string, headers or breadcrumbs', () => {
    // Asserted on the shape rather than on values, so a field added later fails
    // here rather than quietly shipping.
    expect(Object.keys(event).sort()).toEqual([
      'environment', 'event_id', 'exception', 'level', 'logger',
      'platform', 'release', 'tags', 'timestamp',
    ]);
    expect(Object.keys(event.tags).sort()).toEqual([
      'daycare', 'method', 'role', 'route', 'status',
    ]);
  });

  it('still says what broke and where', () => {
    expect(event.exception.values[0].type).toBe('Error');
    expect(event.exception.values[0].value).toContain('insert failed');
    expect(event.exception.values[0].stacktrace.frames[0].filename)
      .toBe('/app/server/storage.ts');
  });

  it('reports an anonymous caller as anonymous rather than omitting the tag', () => {
    const anonymous = buildErrorEvent(new Error('x'), {
      method: 'GET', path: '/api/health', status: 500,
    });
    expect(anonymous.tags.role).toBe('anonymous');
    expect(anonymous.tags.daycare).toBe('none');
  });

  it('handles something thrown that is not an Error', () => {
    const event = buildErrorEvent('plain string failure', {
      method: 'GET', path: '/api/health', status: 500,
    });
    expect(event.exception.values[0].value).toBe('plain string failure');
    expect(event.exception.values[0].stacktrace.frames).toEqual([]);
  });
});

describe('Reading the DSN', () => {
  it('builds the ingest URL and key from a valid DSN', () => {
    expect(parseDsn('https://abc123@o1.ingest.sentry.io/456')).toEqual({
      url: 'https://o1.ingest.sentry.io/api/456/envelope/',
      key: 'abc123',
    });
  });

  it('refuses anything that is not one, rather than posting somewhere odd', () => {
    for (const bad of ['', 'not-a-dsn', 'http://abc@host/1', 'https://host/1']) {
      expect(parseDsn(bad)).toBeNull();
    }
  });
});
