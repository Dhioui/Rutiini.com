/**
 * Care time arithmetic.
 *
 * The daylight-saving cases are the reason this module exists as pure functions.
 * A deadline of "Sunday 23:59 in Helsinki" is a different UTC instant in March
 * than in November, and getting it wrong means bookings close an hour early or
 * late for the weeks around each transition -- twice a year, quietly.
 */

import { describe, it, expect } from 'vitest';
import {
  isoWeekday,
  isoWeekStart,
  reservationDeadline,
  isReservationLocked,
  clockMinutes,
  reservedMinutes,
  realisedMinutes,
  isPresent,
  monthBounds,
  zonedWallClockToInstant,
  careTimeAccessDenial,
  canActOnChild,
  zonedDate,
} from '../careTime';

const DEFAULT_LOCK = { reservationLockDaysBefore: 1, reservationLockTime: '23:59' };

describe('ISO weekdays and week starts', () => {
  it('numbers Monday as 1 and Sunday as 7', () => {
    expect(isoWeekday('2026-03-02')).toBe(1); // Monday
    expect(isoWeekday('2026-03-08')).toBe(7); // Sunday
  });

  it('finds the Monday of the week for every day in it', () => {
    for (const day of ['2026-03-02', '2026-03-05', '2026-03-08']) {
      expect(isoWeekStart(day)).toBe('2026-03-02');
    }
  });

  it('does not slide a week when the month changes underneath it', () => {
    expect(isoWeekStart('2026-04-01')).toBe('2026-03-30');
  });

  it('rejects something that is not a date rather than guessing', () => {
    expect(() => isoWeekStart('1.3.2026')).toThrow();
  });
});

describe('Wall clock to instant', () => {
  it('resolves winter time as UTC+2', () => {
    // 2026-01-15 12:00 Helsinki (EET) is 10:00 UTC.
    expect(zonedWallClockToInstant(2026, 1, 15, 12, 0).toISOString()).toBe('2026-01-15T10:00:00.000Z');
  });

  it('resolves summer time as UTC+3', () => {
    // 2026-07-15 12:00 Helsinki (EEST) is 09:00 UTC.
    expect(zonedWallClockToInstant(2026, 7, 15, 12, 0).toISOString()).toBe('2026-07-15T09:00:00.000Z');
  });
});

describe('Reservation deadline', () => {
  it('closes the whole week on the Sunday evening before it', () => {
    // Week of Monday 2026-03-02. Deadline: Sunday 2026-03-01 23:59 Helsinki,
    // which in winter time is 21:59 UTC.
    const deadline = reservationDeadline('2026-03-04', DEFAULT_LOCK);
    expect(deadline.toISOString()).toBe('2026-03-01T21:59:00.000Z');
  });

  it('gives every day of one week the same deadline', () => {
    const week = ['2026-03-02', '2026-03-03', '2026-03-06', '2026-03-08'];
    const deadlines = week.map((d) => reservationDeadline(d, DEFAULT_LOCK).toISOString());
    expect(new Set(deadlines).size).toBe(1);
  });

  it('shifts by one hour across the spring transition, not by zero', () => {
    // Finland moves to EEST on the last Sunday of March 2026 (29 March).
    // A week before that is still winter time; a week after is summer time.
    const winter = reservationDeadline('2026-03-23', DEFAULT_LOCK); // week of 23 Mar
    const summer = reservationDeadline('2026-04-06', DEFAULT_LOCK); // week of 6 Apr

    expect(winter.toISOString()).toBe('2026-03-22T21:59:00.000Z');
    expect(summer.toISOString()).toBe('2026-04-05T20:59:00.000Z');
  });

  it('honours a different rule without code changes', () => {
    // Two days before the Monday, at noon: Saturday 2026-02-28 12:00 Helsinki.
    const deadline = reservationDeadline('2026-03-04', {
      reservationLockDaysBefore: 2,
      reservationLockTime: '12:00',
    });
    expect(deadline.toISOString()).toBe('2026-02-28T10:00:00.000Z');
  });

  it('can cross a month boundary backwards', () => {
    // Week of Monday 2026-06-01 locks on Sunday 2026-05-31.
    const deadline = reservationDeadline('2026-06-03', DEFAULT_LOCK);
    expect(deadline.toISOString()).toBe('2026-05-31T20:59:00.000Z');
  });
});

describe('Whether a date is locked', () => {
  const target = '2026-03-04';

  it('is open a minute before the deadline', () => {
    expect(isReservationLocked(target, DEFAULT_LOCK, new Date('2026-03-01T21:58:00Z'))).toBe(false);
  });

  it('is still open exactly at the deadline', () => {
    expect(isReservationLocked(target, DEFAULT_LOCK, new Date('2026-03-01T21:59:00Z'))).toBe(false);
  });

  it('is locked a minute after', () => {
    expect(isReservationLocked(target, DEFAULT_LOCK, new Date('2026-03-01T22:00:00Z'))).toBe(true);
  });

  it('is open weeks ahead', () => {
    expect(isReservationLocked(target, DEFAULT_LOCK, new Date('2026-02-01T00:00:00Z'))).toBe(false);
  });
});

describe('Durations', () => {
  it('reads a clock time as minutes since midnight', () => {
    expect(clockMinutes('00:00')).toBe(0);
    expect(clockMinutes('08:30')).toBe(510);
    expect(clockMinutes('23:59')).toBe(1439);
  });

  it('measures a booked day', () => {
    expect(reservedMinutes('08:00', '16:30')).toBe(510);
  });

  it('sums only the closed stays', () => {
    const records = [
      { checkInAt: new Date('2026-03-04T06:00:00Z'), checkOutAt: new Date('2026-03-04T09:00:00Z') },
      { checkInAt: new Date('2026-03-04T10:00:00Z'), checkOutAt: new Date('2026-03-04T12:30:00Z') },
    ];
    expect(realisedMinutes(records)).toBe(330);
  });

  it('counts nothing for a child who has not been checked out', () => {
    // Not zero because the child was not here -- zero because how long they were
    // here is not yet known, and billing must not be handed a guess.
    const records = [
      { checkInAt: new Date('2026-03-04T06:00:00Z'), checkOutAt: null },
    ];
    expect(realisedMinutes(records)).toBe(0);
  });

  it('ignores a check-out recorded before its check-in', () => {
    const records = [
      { checkInAt: new Date('2026-03-04T09:00:00Z'), checkOutAt: new Date('2026-03-04T06:00:00Z') },
    ];
    expect(realisedMinutes(records)).toBe(0);
  });

  it('reports a child as present while any stay is open', () => {
    expect(isPresent([{ checkOutAt: new Date() }, { checkOutAt: null }])).toBe(true);
    expect(isPresent([{ checkOutAt: new Date() }])).toBe(false);
    expect(isPresent([])).toBe(false);
  });
});

describe('Month bounds', () => {
  it('covers a 31 day month', () => {
    expect(monthBounds('2026-01')).toEqual({ from: '2026-01-01', to: '2026-01-31' });
  });

  it('covers February in a common year', () => {
    expect(monthBounds('2026-02')).toEqual({ from: '2026-02-01', to: '2026-02-28' });
  });

  it('covers February in a leap year', () => {
    expect(monthBounds('2028-02')).toEqual({ from: '2028-02-01', to: '2028-02-29' });
  });

  it('rejects a malformed month', () => {
    expect(() => monthBounds('2026-1')).toThrow();
  });
});

/**
 * The gate on every care time endpoint.
 *
 * These run the same functions the routes call, so a route cannot drift away
 * from what is asserted here without the import breaking.
 */
describe('Care time access gate', () => {
  const enabled = { reservationsEnabled: true };
  const disabled = { reservationsEnabled: false };

  it('refuses super admin, because care time is personal data', () => {
    expect(careTimeAccessDenial({ role: 'super_admin', daycareId: null }, enabled))
      .toEqual({ status: 403, reason: 'gdpr' });
  });

  it('refuses super admin even when they somehow carry a daycare', () => {
    expect(careTimeAccessDenial({ role: 'super_admin', daycareId: 1 }, enabled)?.reason).toBe('gdpr');
  });

  it('refuses a user with no daycare', () => {
    expect(careTimeAccessDenial({ role: 'staff', daycareId: null }, enabled))
      .toEqual({ status: 403, reason: 'unauthorized' });
  });

  it('reports the feature as absent when the daycare has not enabled it', () => {
    expect(careTimeAccessDenial({ role: 'guardian', daycareId: 1 }, disabled))
      .toEqual({ status: 404, reason: 'disabled' });
  });

  it('reports the feature as absent when the daycare could not be loaded', () => {
    expect(careTimeAccessDenial({ role: 'staff', daycareId: 999 }, undefined)?.reason).toBe('disabled');
  });

  it('lets every ordinary role through once the feature is on', () => {
    for (const role of ['guardian', 'staff', 'daycareleader']) {
      expect(careTimeAccessDenial({ role, daycareId: 1 }, enabled)).toBeNull();
    }
  });
});

describe('Care time tenant isolation', () => {
  // The accessible list is built from the caller's own guardianship or their own
  // daycare's roster, never from the request body. A child id belonging to
  // another daycare is therefore simply not in it.
  const ownDaycareChildren = [10, 11, 12];

  it('refuses a child id from another daycare', () => {
    expect(canActOnChild(ownDaycareChildren, 99)).toBe(false);
  });

  it('refuses a guardian a child they are not linked to', () => {
    const ownChildren = [10];
    expect(canActOnChild(ownChildren, 11)).toBe(false);
  });

  it('allows a child in the caller\'s own set', () => {
    expect(canActOnChild(ownDaycareChildren, 11)).toBe(true);
  });

  it('refuses everything when the caller has no accessible children', () => {
    expect(canActOnChild([], 10)).toBe(false);
  });

  it('does not treat a numeric string as a match', () => {
    expect(canActOnChild(ownDaycareChildren, '10' as unknown as number)).toBe(false);
  });
});

describe('Local calendar date of an instant', () => {
  it('agrees with UTC during ordinary opening hours', () => {
    // 07:30 Helsinki in winter is 05:30 UTC -- same day either way.
    expect(zonedDate(new Date('2026-01-15T05:30:00Z'))).toBe('2026-01-15');
  });

  it('files an after-midnight check-in under the local day, not the UTC one', () => {
    // 00:30 Helsinki on 16 January is 22:30 UTC on the 15th. Round-the-clock
    // care exists, and the stay belongs to the 16th.
    const instant = new Date('2026-01-15T22:30:00Z');
    expect(instant.toISOString().slice(0, 10)).toBe('2026-01-15');
    expect(zonedDate(instant)).toBe('2026-01-16');
  });

  it('does the same in summer time, where the gap is three hours', () => {
    // 01:00 Helsinki on 16 July is 22:00 UTC on the 15th.
    expect(zonedDate(new Date('2026-07-15T22:00:00Z'))).toBe('2026-07-16');
  });
});
