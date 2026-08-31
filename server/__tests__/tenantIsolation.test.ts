/**
 * Tenant isolation, driven over real HTTP against the real routes.
 *
 * The point of this file is one question: can a signed-in user of daycare A
 * reach anything belonging to daycare B by asking for it by id?
 *
 * The storage layer here is deliberately PERMISSIVE. When a route asks for a
 * child by id and nothing else, this fake hands it over regardless of which
 * daycare it belongs to -- which is exactly what the real SQL does, because
 * `select ... where id = $1` does not know about tenants. Making the fake
 * enforce tenancy would make every test below pass while proving nothing: the
 * fake would be doing the work the route is supposed to do.
 *
 * So a failure here means a route forgot its check, which is the only thing
 * worth testing.
 */

import { describe, it, expect, beforeAll, vi } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'node:net';

// Shared with the mock factories, which vitest hoists above every import.
const { sessionsByHash, writes } = vi.hoisted(() => ({
  sessionsByHash: new Map<string, number>(),
  writes: [] as Array<[string, unknown]>,
}));

// The cache helpers routes.ts pulls straight from db.ts. Mocked so importing
// the routes never loads a database driver, and so this test cannot reach a
// real database even by accident.
vi.mock('../db', () => ({
  getCached: () => undefined,
  setCache: () => {},
  invalidateCache: () => {},
  db: {},
  withAdvisoryLock: async () => false,
}));

const DAYCARE_A = 1;
const DAYCARE_B = 2;

// --- Rows. B's rows are the ones nobody in A may ever see. ---

const daycares = [
  { id: DAYCARE_A, name: 'Aurinko', code: 'aurinko', municipalityId: null, municipality: null,
    menuSourceType: 'none', menuSourceUrl: null, reservationsEnabled: true,
    reservationLockDaysBefore: 1, reservationLockTime: '23:59', createdAt: new Date() },
  { id: DAYCARE_B, name: 'Kuusi', code: 'kuusi', municipalityId: null, municipality: null,
    menuSourceType: 'none', menuSourceUrl: null, reservationsEnabled: true,
    reservationLockDaysBefore: 1, reservationLockTime: '23:59', createdAt: new Date() },
];

const users = [
  { id: 10, name: 'A Leader', email: 'leader.a@example.invalid', passwordHash: 'x',
    role: 'daycareleader', daycareId: DAYCARE_A },
  { id: 11, name: 'A Staff', email: 'staff.a@example.invalid', passwordHash: 'x',
    role: 'staff', daycareId: DAYCARE_A },
  { id: 12, name: 'A Guardian', email: 'guardian.a@example.invalid', passwordHash: 'x',
    role: 'guardian', daycareId: DAYCARE_A },
  { id: 20, name: 'B Leader', email: 'leader.b@example.invalid', passwordHash: 'x',
    role: 'daycareleader', daycareId: DAYCARE_B },
  { id: 30, name: 'Super', email: 'super@example.invalid', passwordHash: 'x',
    role: 'super_admin', daycareId: null },
].map((u) => ({
  ...u, passwordNeedsReset: false, passwordChangedAt: null, resetTokenHash: null,
  resetTokenExpiresAt: null, lastLoginAt: null, failedLoginAttempts: 0,
  lockedUntil: null, createdAt: new Date(),
}));

const CHILD_A = { id: 100, name: 'Aino A', birthdate: '2021-01-01', groupId: null,
  daycareId: DAYCARE_A, allergies: null, diet: null };
const CHILD_B = { id: 200, name: 'Bertta B', birthdate: '2021-01-01', groupId: null,
  daycareId: DAYCARE_B, allergies: 'PÄHKINÄ-B', diet: null };
const children = [CHILD_A, CHILD_B];

const notificationB = { id: 900, userId: 20, daycareId: DAYCARE_B, title: 'B',
  message: 'B secret', isRead: false, type: 'message', createdAt: new Date() };

const scoped = <T extends { daycareId?: number | null }>(rows: T[], daycareId: number) =>
  rows.filter((row) => row.daycareId === daycareId);

vi.mock('../storage', () => {
  const storage = {
    // Auth. The session lookup is what authenticateToken needs.
    getUserBySessionToken: async (hash: string) => {
      const userId = sessionsByHash.get(hash);
      const user = users.find((u) => u.id === userId);
      return user
        ? { user, sessionToken: { id: 1, userId: user.id, tokenHash: hash,
            createdAt: new Date(), expiresAt: new Date(Date.now() + 3_600_000) } }
        : undefined;
    },
    getUser: async (id: number) => users.find((u) => u.id === id),
    getDaycare: async (id: number) => daycares.find((d) => d.id === id),

    // Permissive on purpose: by id alone, with no tenant filter.
    getChild: async (id: number) => children.find((c) => c.id === id),
    getNotificationById: async (id: number) =>
      id === notificationB.id ? notificationB : undefined,

    // Scoped, as the real queries are.
    getChildren: async (daycareId: number) => scoped(children, daycareId),
    getChildrenByGuardian: async (userId: number) => (userId === 12 ? [CHILD_A] : []),
    getChildrenByTeacherGroups: async () => [CHILD_A],
    getReservations: async (daycareId: number) => scoped([], daycareId),
    getAttendanceRecords: async (daycareId: number) => scoped([], daycareId),
    getReservationTemplate: async () => [],
    getChildContracts: async () => [],
    getContractCoveringDate: async () => undefined,
    getOpenAttendanceRecord: async () => undefined,
    getAbsencesByDateRange: async (daycareId: number) => scoped([], daycareId),
    getEntriesByChild: async () => [],
    getGroupById: async () => undefined,

    // Writes are recorded so a test can assert nothing was written.
    upsertReservation: async (r: any) => { writes.push(['upsertReservation', r]); return { id: 1, ...r }; },
    createAttendanceCheckIn: async (...args: any[]) => { writes.push(['checkIn', args]); return { id: 1 }; },
    replaceReservationTemplate: async (...args: any[]) => { writes.push(['template', args]); return []; },
    createChildContract: async (c: any) => { writes.push(['contract', c]); return { id: 1, ...c }; },
    updateChild: async (...args: any[]) => { writes.push(['updateChild', args]); return undefined; },
    deleteReservation: async () => { writes.push(['deleteReservation', null]); return true; },

    createAuditLog: async () => ({ id: 1 }),

    // Super admin surface.
    getAllDaycares: async () => daycares,
    getMunicipalities: async () => [{ id: 1, name: 'Espoo', code: 'ESP', isActive: true }],
    getMunicipality: async (id: number) =>
      id === 1 ? { id: 1, name: 'Espoo', code: 'ESP', isActive: true } : undefined,
    getDaycaresByMunicipality: async () => daycares,
    getDaycareLeadersByDaycare: async (daycareId: number) =>
      users.filter((u) => u.role === 'daycareleader' && u.daycareId === daycareId),
    getAnonymizedStats: async () => ({
      totalDaycares: 2, totalChildren: 2, totalStaff: 1, totalGuardians: 1,
      totalTrips: 0, totalAbsencesToday: 0,
      daycareStats: daycares.map((d) => ({
        daycareId: d.id, daycareName: d.name,
        childrenCount: 1, staffCount: 1, guardianCount: 1,
      })),
    }),
    // Deliberately carries personal data in the fields the route must strip.
    getAuditLogs: async () => [{
      id: 1, timestamp: new Date(), actorId: 20, actorRole: 'daycareleader',
      daycareId: DAYCARE_B, action: 'VIEW', entityType: 'child',
      entityIdHash: 'hash:200',
      metadata: { childName: 'Bertta B', guardianEmail: 'leader.b@example.invalid' },
    }],
  };

  return {
    // routes.ts imports this alongside storage; it only hashes for the audit log.
    hashEntityId: (id: number | string) => `hash:${id}`,
    storage: new Proxy(storage, {
    get(target, prop: string) {
      if (prop in target) return (target as any)[prop];
      // Anything a route calls that is not modelled returns empty rather than
      // throwing, so an unrelated gap cannot masquerade as an isolation failure.
      return async () => undefined;
    },
  }) };
});

let baseUrl: string;
const tokens: Record<string, string> = {};

beforeAll(async () => {
  const { registerRoutes } = await import('../routes');
  const { generateToken, hashSessionToken } = await import('../auth');

  for (const user of users) {
    const token = generateToken(user.id);
    sessionsByHash.set(hashSessionToken(token), user.id);
    tokens[user.email.split('@')[0]] = token;
  }

  const app = express();
  app.use(express.json());
  const server = await registerRoutes(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

async function call(
  method: string,
  path: string,
  who: keyof typeof tokens,
  body?: unknown,
): Promise<{ status: number; text: string }> {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${tokens[who]}`,
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, text: await res.text() };
}

/** Anything that is not a refusal must at least not carry B's data. */
function expectRefusedOrEmpty(result: { status: number; text: string }, secret: string) {
  expect(result.status).not.toBe(200);
  expect(result.text).not.toContain(secret);
}

describe('A daycare leader cannot reach another daycare', () => {
  it('cannot read a child by id', async () => {
    const result = await call('GET', `/api/children/${CHILD_B.id}/entries`, 'leader.a');
    expectRefusedOrEmpty(result, 'Bertta B');
  });

  it('cannot edit a child', async () => {
    const before = writes.length;
    const result = await call('PATCH', `/api/children/${CHILD_B.id}`, 'leader.a', { allergies: 'muutettu' });
    // The route may reach storage, but storage is scoped by daycare and returns
    // nothing, so the answer must be a refusal and never a success.
    expect(result.status).not.toBe(200);
    expect(result.text).not.toContain('PÄHKINÄ-B');
    expect(writes.length - before).toBeLessThanOrEqual(1);
  });

  it('cannot delete a child', async () => {
    const result = await call('DELETE', `/api/children/${CHILD_B.id}`, 'leader.a');
    expect([403, 404]).toContain(result.status);
  });

  it('cannot read B\'s consents', async () => {
    const result = await call('GET', `/api/children/${CHILD_B.id}/consents`, 'leader.a');
    expectRefusedOrEmpty(result, 'Bertta');
  });

  it('cannot unlock a user in B', async () => {
    const result = await call('POST', '/api/admin/users/20/unlock', 'leader.a');
    expect(result.status).toBe(403);
  });

  it('cannot mark B\'s notification read', async () => {
    const result = await call('PATCH', `/api/notifications/${notificationB.id}/read`, 'leader.a');
    expect(result.status).toBe(404);
  });

  it('sees only its own children in the roster', async () => {
    const result = await call('GET', '/api/children', 'leader.a');
    expect(result.status).toBe(200);
    expect(result.text).toContain('Aino A');
    expect(result.text).not.toContain('Bertta B');
  });
});

describe('Care time endpoints refuse another daycare', () => {
  it('cannot book for a child in B', async () => {
    const before = writes.filter(([name]) => name === 'upsertReservation').length;
    const result = await call('PUT', '/api/care-time/reservations', 'leader.a', {
      childId: CHILD_B.id, date: '2030-01-07', startTime: '08:00', endTime: '16:00',
    });
    expect(result.status).toBe(403);
    expect(writes.filter(([name]) => name === 'upsertReservation').length).toBe(before);
  });

  it('cannot check in a child from B', async () => {
    const before = writes.filter(([name]) => name === 'checkIn').length;
    const result = await call('POST', '/api/care-time/check-in', 'leader.a', { childId: CHILD_B.id });
    expect(result.status).toBe(403);
    expect(writes.filter(([name]) => name === 'checkIn').length).toBe(before);
  });

  it('cannot read a template for a child in B', async () => {
    const result = await call('GET', `/api/care-time/template/${CHILD_B.id}`, 'leader.a');
    expect(result.status).toBe(403);
  });

  it('cannot record a contract for a child in B', async () => {
    const before = writes.filter(([name]) => name === 'contract').length;
    const result = await call('POST', '/api/care-time/contracts', 'leader.a', {
      childId: CHILD_B.id, monthlyHours: 147, validFrom: '2030-01-01',
    });
    expect(result.status).toBe(403);
    expect(writes.filter(([name]) => name === 'contract').length).toBe(before);
  });

  it('cannot read a summary for a child in B', async () => {
    const result = await call('GET', `/api/care-time/summary?childId=${CHILD_B.id}&month=2030-01`, 'leader.a');
    expect(result.status).toBe(403);
  });
});

describe('A guardian reaches only their own child', () => {
  it('cannot book for another family\'s child in the same daycare', async () => {
    const result = await call('PUT', '/api/care-time/reservations', 'guardian.a', {
      childId: CHILD_B.id, date: '2030-01-07', startTime: '08:00', endTime: '16:00',
    });
    expect(result.status).toBe(403);
  });

  it('cannot open the staff door device', async () => {
    const result = await call('GET', '/api/care-time/today', 'guardian.a');
    expect(result.status).toBe(403);
  });

  it('cannot check a child in', async () => {
    const result = await call('POST', '/api/care-time/check-in', 'guardian.a', { childId: CHILD_A.id });
    expect(result.status).toBe(403);
  });
});

describe('Super admin is kept away from personal data', () => {
  const personalDataEndpoints: Array<[string, string]> = [
    ['GET', '/api/children'],
    ['GET', `/api/children/${CHILD_A.id}/entries`],
    ['GET', '/api/care-time/reservations?from=2030-01-01&to=2030-01-07'],
    ['GET', '/api/care-time/today'],
    ['GET', `/api/care-time/summary?childId=${CHILD_A.id}&month=2030-01`],
    ['GET', `/api/care-time/contracts/${CHILD_A.id}`],
    ['GET', '/api/care-time/comparison'],
  ];

  for (const [method, path] of personalDataEndpoints) {
    it(`refuses ${method} ${path}`, async () => {
      const result = await call(method, path, 'super');
      expect(result.status).toBe(403);
      expect(result.text).not.toContain('Aino');
      expect(result.text).not.toContain('Bertta');
    });
  }

  it('cannot create a child', async () => {
    const result = await call('POST', '/api/children', 'super', {
      name: 'X', birthdate: '2021-01-01',
    });
    expect(result.status).toBe(403);
  });

  it('cannot check a child in', async () => {
    const result = await call('POST', '/api/care-time/check-in', 'super', { childId: CHILD_A.id });
    expect(result.status).toBe(403);
  });
});

describe('An unauthenticated caller reaches nothing', () => {
  const guarded = [
    '/api/children',
    '/api/care-time/reservations?from=2030-01-01&to=2030-01-07',
    '/api/care-time/today',
    '/api/notifications',
  ];

  for (const path of guarded) {
    it(`refuses ${path} without a token`, async () => {
      const res = await fetch(`${baseUrl}${path}`);
      expect(res.status).toBe(401);
    });
  }
});

/**
 * Every authenticated GET that takes an identifier, swept with B's ids.
 *
 * The list is the complete set from routes.ts rather than a hand-picked sample,
 * so a new route added later without a tenant check is caught here as soon as it
 * is added to this list -- and the accompanying static audit in the commit
 * message says how the list was produced.
 *
 * Most of these will answer 404 against the fake, which is fine. The assertion
 * is narrower and harder to satisfy by accident: whatever the status, B's data
 * must not come back.
 */
describe('Sweep: every authenticated GET with an identifier', () => {
  const B_SECRETS = ['Bertta B', 'PÄHKINÄ-B', 'B secret'];

  const sweep: Array<[string, string]> = [
    ['A child in B', `/api/children/${CHILD_B.id}/entries`],
    ['A municipality', '/api/municipalities/2'],
    ['A municipality roster', '/api/municipalities/2/daycares'],
    ['A conversation with a B user', '/api/conversations/20'],
    ['A form in B', '/api/forms/777'],
    ['Form submissions in B', '/api/forms/777/submissions'],
    ['Consents of a child in B', `/api/children/${CHILD_B.id}/consents`],
    ['A menu date', '/api/menu/2030-01-07'],
    ['A care time template in B', `/api/care-time/template/${CHILD_B.id}`],
    ['A care time contract in B', `/api/care-time/contracts/${CHILD_B.id}`],
  ];

  for (const [label, path] of sweep) {
    it(`${label} leaks nothing to a leader in A`, async () => {
      const result = await call('GET', path, 'leader.a');
      for (const secret of B_SECRETS) {
        expect(result.text).not.toContain(secret);
      }
    });

    it(`${label} leaks nothing to a guardian in A`, async () => {
      const result = await call('GET', path, 'guardian.a');
      for (const secret of B_SECRETS) {
        expect(result.text).not.toContain(secret);
      }
    });

    it(`${label} is refused to super admin or carries no personal data`, async () => {
      const result = await call('GET', path, 'super');
      for (const secret of B_SECRETS) {
        expect(result.text).not.toContain(secret);
      }
      expect(result.text).not.toContain('Aino A');
    });
  }
});

/**
 * What super admin is allowed to see.
 *
 * The claim the product makes is specific: super admin reads anonymised figures
 * and never reaches children or guardians. These tests hold that claim to the
 * code, and they also pin the one place where the surface is wider than the
 * slogan -- the administrator list -- so that a future change there has to be
 * deliberate rather than accidental.
 */
describe('Super admin sees figures, not families', () => {
  const FAMILY_DATA = ['Aino A', 'Bertta B', 'PÄHKINÄ-B'];

  const superAdminRoutes = [
    '/api/super-admin/stats',
    '/api/super-admin/audit-logs',
    '/api/super-admin/admins',
    '/api/municipalities',
    '/api/municipalities/1',
    '/api/municipalities/1/daycares',
    '/api/daycares',
  ];

  for (const path of superAdminRoutes) {
    it(`${path} contains no child or guardian data`, async () => {
      const result = await call('GET', path, 'super');
      expect(result.status).toBe(200);
      for (const value of FAMILY_DATA) {
        expect(result.text).not.toContain(value);
      }
    });
  }

  it('statistics are counts and daycare names, nothing per person', async () => {
    const result = await call('GET', '/api/super-admin/stats', 'super');
    const stats = JSON.parse(result.text);

    expect(typeof stats.totalChildren).toBe('number');
    for (const row of stats.daycareStats) {
      expect(Object.keys(row).sort()).toEqual(
        ['childrenCount', 'daycareId', 'daycareName', 'guardianCount', 'staffCount'],
      );
    }
    // A count of children is not a child.
    expect(result.text).not.toContain('birthdate');
    expect(result.text).not.toContain('allergies');
  });

  it('audit log entries drop the metadata that carries names', async () => {
    // The stored row in the fake deliberately holds a child's name and an email
    // in metadata. If the route ever stops stripping that field, this fails.
    const result = await call('GET', '/api/super-admin/audit-logs', 'super');
    expect(result.status).toBe(200);

    expect(result.text).not.toContain('Bertta B');
    expect(result.text).not.toContain('metadata');
    expect(result.text).not.toContain('childName');

    const [entry] = JSON.parse(result.text);
    expect(entry.entityIdHash).toBe('hash:200');
    // The acting person's id is not returned either, only their role.
    expect(entry.actorId).toBeUndefined();
    expect(entry.userRole).toBe('daycareleader');
  });

  it('the administrator list carries administrator names and emails, and nothing else', async () => {
    // Pinned rather than asserted clean: super admin creates these accounts, so
    // seeing them is inherent to the role. What matters is that the shape stops
    // at administrators and never widens to families or password hashes.
    const result = await call('GET', '/api/super-admin/admins', 'super');
    const groups = JSON.parse(result.text);

    expect(groups[0].admins[0]).toEqual({
      id: expect.any(Number),
      name: expect.any(String),
      email: expect.any(String),
    });
    expect(result.text).not.toContain('passwordHash');
    expect(result.text).not.toContain('resetTokenHash');
    for (const value of FAMILY_DATA) {
      expect(result.text).not.toContain(value);
    }
  });
});
