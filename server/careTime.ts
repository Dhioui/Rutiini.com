/**
 * Care time arithmetic: when a booking closes, and how long a day lasted.
 *
 * Everything here is a pure function over strings and Dates so it can be tested
 * without a database, the way the authorization predicates in auth.ts are.
 *
 * Times are 'HH:MM' wall clock and dates are 'YYYY-MM-DD', because that is what a
 * guardian booked -- 08:00 means eight in the morning in Finland whatever the
 * server's clock is set to. Instants (a child walking through the door) are real
 * timestamps. The two only meet in the deadline calculation below.
 */

/**
 * Finnish daycare, Finnish wall clock. Hard-coded rather than configurable for
 * the same reason the nightly jobs in index.ts are: a deadline of "Sunday 23:59"
 * means Sunday 23:59 in Helsinki, and a deployment in another region does not
 * change what the daycare agreed with its guardians.
 */
export const CARE_TIME_ZONE = 'Europe/Helsinki';

/** How far the named zone is ahead of UTC at the given instant, in milliseconds. */
function zoneOffsetMs(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(instant);

  const at = (type: string) => Number(parts.find((p) => p.type === type)!.value);
  const asIfUtc = Date.UTC(at('year'), at('month') - 1, at('day'), at('hour'), at('minute'), at('second'));
  return asIfUtc - instant.getTime();
}

/**
 * The instant at which a wall-clock time in the given zone occurs.
 *
 * Resolved twice because the offset depends on the instant we are still solving
 * for: near a daylight-saving change the first guess can land on the wrong side
 * of the transition, and the second pass corrects it.
 */
export function zonedWallClockToInstant(
  year: number, month: number, day: number,
  hours: number, minutes: number,
  timeZone: string = CARE_TIME_ZONE,
): Date {
  const naive = Date.UTC(year, month - 1, day, hours, minutes);
  const firstPass = new Date(naive - zoneOffsetMs(new Date(naive), timeZone));
  return new Date(naive - zoneOffsetMs(firstPass, timeZone));
}

/** Splits 'YYYY-MM-DD' without going through Date, which would apply a timezone. */
function parseDateParts(date: string): { year: number; month: number; day: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) throw new Error(`Expected YYYY-MM-DD, got ${date}`);
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

function toIsoDate(utc: Date): string {
  return utc.toISOString().slice(0, 10);
}

/** ISO-8601 weekday: 1 = Monday ... 7 = Sunday. */
export function isoWeekday(date: string): number {
  const { year, month, day } = parseDateParts(date);
  const sundayIsZero = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return sundayIsZero === 0 ? 7 : sundayIsZero;
}

/** The Monday of the week containing `date`, as 'YYYY-MM-DD'. */
export function isoWeekStart(date: string): string {
  const { year, month, day } = parseDateParts(date);
  const midnight = Date.UTC(year, month - 1, day);
  const backToMonday = (isoWeekday(date) - 1) * 86_400_000;
  return toIsoDate(new Date(midnight - backToMonday));
}

export interface ReservationLockSettings {
  /** Days before the Monday of the target week that bookings close. */
  reservationLockDaysBefore: number;
  /** Wall-clock time on that day, 'HH:MM'. */
  reservationLockTime: string;
}

/**
 * The moment bookings for `date` stop being editable.
 *
 * Measured from the Monday of that date's week rather than from the date itself,
 * so a whole week locks at once: with the default of one day at 23:59, every day
 * of a week closes on the Sunday evening before it, which is how these
 * arrangements are usually described to guardians.
 */
export function reservationDeadline(date: string, settings: ReservationLockSettings): Date {
  const monday = isoWeekStart(date);
  const { year, month, day } = parseDateParts(monday);
  const deadlineDay = new Date(
    Date.UTC(year, month - 1, day) - settings.reservationLockDaysBefore * 86_400_000,
  );
  const [hours, minutes] = settings.reservationLockTime.split(':').map(Number);

  return zonedWallClockToInstant(
    deadlineDay.getUTCFullYear(),
    deadlineDay.getUTCMonth() + 1,
    deadlineDay.getUTCDate(),
    hours,
    minutes,
  );
}

export function isReservationLocked(
  date: string,
  settings: ReservationLockSettings,
  now: Date = new Date(),
): boolean {
  return now.getTime() > reservationDeadline(date, settings).getTime();
}

/** Minutes since midnight for 'HH:MM'. */
export function clockMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/** Length of a booked day in minutes. */
export function reservedMinutes(startTime: string, endTime: string): number {
  return clockMinutes(endTime) - clockMinutes(startTime);
}

/**
 * Realised minutes across a day's check-in rows.
 *
 * Only closed pairs count. A row with no check-out is a child who is still here,
 * or a check-out nobody remembered to tap; either way there is no defensible
 * duration yet, and inventing one would put a guess into a figure that billing is
 * meant to be built on.
 */
export function realisedMinutes(
  records: ReadonlyArray<{ checkInAt: Date; checkOutAt: Date | null }>,
): number {
  return records.reduce((total, record) => {
    if (!record.checkOutAt) return total;
    const spanMs = record.checkOutAt.getTime() - record.checkInAt.getTime();
    return spanMs > 0 ? total + Math.round(spanMs / 60_000) : total;
  }, 0);
}

/** True when any row is still open, which is what "currently present" means. */
export function isPresent(
  records: ReadonlyArray<{ checkOutAt: Date | null }>,
): boolean {
  return records.some((record) => record.checkOutAt === null);
}

/** First and last day of a 'YYYY-MM' month, as 'YYYY-MM-DD'. */
export function monthBounds(month: string): { from: string; to: string } {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match) throw new Error(`Expected YYYY-MM, got ${month}`);
  const year = Number(match[1]);
  const monthNumber = Number(match[2]);
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return {
    from: `${match[1]}-${match[2]}-01`,
    to: `${match[1]}-${match[2]}-${String(lastDay).padStart(2, '0')}`,
  };
}

/**
 * Whether a caller may use the care time endpoints at all.
 *
 * Kept here as a pure decision rather than inline in each route, because the
 * three conditions have to hold on every one of them and a route that forgot one
 * would leak across tenants silently. Returns the refusal to send, or null to
 * proceed.
 */
export function careTimeAccessDenial(
  caller: { role: string; daycareId: number | null },
  daycare: { reservationsEnabled: boolean } | undefined,
): { status: number; reason: 'gdpr' | 'unauthorized' | 'disabled' } | null {
  // Super admin reads anonymised statistics only; care time is personal data.
  if (caller.role === 'super_admin') return { status: 403, reason: 'gdpr' };

  if (!caller.daycareId) return { status: 403, reason: 'unauthorized' };

  // Off unless a daycare turned it on. 404 rather than 403 because for a daycare
  // that has not enabled it, the feature does not exist.
  if (!daycare?.reservationsEnabled) return { status: 404, reason: 'disabled' };

  return null;
}

/**
 * Whether the caller may act on a particular child.
 *
 * `accessible` is built from the caller's own guardianship or their daycare's
 * roster, never from the request, so a child id belonging to another tenant is
 * simply not in the list.
 */
export function canActOnChild(accessible: ReadonlyArray<number>, childId: number): boolean {
  return accessible.includes(childId);
}

/**
 * The calendar date an instant falls on in Finland, as 'YYYY-MM-DD'.
 *
 * Not `toISOString().slice(0, 10)`, which is the UTC date. Those agree during
 * ordinary opening hours but part company after midnight local time: a child
 * checked in at 00:30 in round-the-clock care is 22:30 the previous day in UTC,
 * and the stay would be filed under the wrong date -- in the figures billing is
 * meant to be built on.
 */
export function zonedDate(instant: Date, timeZone: string = CARE_TIME_ZONE): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(instant);
  const at = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${at('year')}-${at('month')}-${at('day')}`;
}
