/**
 * Calendar helpers. Months are identified by a "month key" ("2026-10") and
 * days by an ISO date ("2026-10-04"), both in the app's configured timezone.
 * Pure functions — safe on server and client.
 */

const MONTH_KEY_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const DAY_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

export function isMonthKey(value: string): boolean {
  return MONTH_KEY_RE.test(value);
}

export function isIsoDay(value: string): boolean {
  if (!DAY_RE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

export function isWallTime(value: string): boolean {
  return TIME_RE.test(value);
}

export function monthKeyOf(day: string): string {
  return day.slice(0, 7);
}

function monthDate(key: string) {
  const [y, m] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1));
}

/** "October 2026" */
export function monthLabel(key: string): string {
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    monthDate(key),
  );
}

/** "October" */
export function monthName(key: string): string {
  return new Intl.DateTimeFormat("en-US", { month: "long", timeZone: "UTC" }).format(monthDate(key));
}

export function previousMonthKey(key: string): string {
  const d = monthDate(key);
  d.setUTCMonth(d.getUTCMonth() - 1);
  return d.toISOString().slice(0, 7);
}

export function nextMonthKey(key: string): string {
  const d = monthDate(key);
  d.setUTCMonth(d.getUTCMonth() + 1);
  return d.toISOString().slice(0, 7);
}

function wallClockParts(instant: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

/** Today's ISO date in the given timezone. */
export function todayIn(timeZone: string, now: Date = new Date()): string {
  const p = wallClockParts(now, timeZone);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

export function currentMonthKeyIn(timeZone: string, now: Date = new Date()): string {
  return monthKeyOf(todayIn(timeZone, now));
}

/** Offset (ms) between the timezone's wall clock and UTC at a given instant. */
function offsetAt(instant: Date, timeZone: string): number {
  const p = wallClockParts(instant, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/**
 * Converts a wall-clock time in a timezone ("2026-10-04" + "18:30") to a UTC
 * instant. Handles DST transitions.
 */
export function zonedTimeToUtc(day: string, time: string, timeZone: string): Date {
  const [y, m, d] = day.split("-").map(Number);
  const [hh, mm, ss = 0] = time.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm, ss);
  let result = guess - offsetAt(new Date(guess), timeZone);
  // Second pass corrects for an offset change between the guess and the result.
  result = guess - offsetAt(new Date(result), timeZone);
  return new Date(result);
}

/** "Sunday, October 4" (or with year when `withYear`). */
export function formatDay(day: string, opts: { withYear?: boolean; weekday?: boolean } = {}): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    weekday: opts.weekday === false ? undefined : "long",
    month: "long",
    day: "numeric",
    year: opts.withYear ? "numeric" : undefined,
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

/** "Oct 4" */
export function formatShortDay(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, d)),
  );
}

export function pluralize(n: number, one: string, many = `${one}s`) {
  return `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;
}
