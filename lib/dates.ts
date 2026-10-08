import type { DateKey } from './types';

// All dates are local calendar days as 'YYYY-MM-DD'. Parsing pins the time to
// noon so adding days never trips over daylight-saving changes.

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const LMON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const LDOW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const pad = (n: number) => String(n).padStart(2, '0');

export function toKey(d: Date): DateKey {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseKey(k: DateKey): Date {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
}

export function todayKey(now: Date = new Date()): DateKey {
  return toKey(now);
}

export function addDays(k: DateKey, n: number): DateKey {
  const d = parseKey(k);
  d.setDate(d.getDate() + n);
  return toKey(d);
}

/** 0 = Sunday … 6 = Saturday. */
export function weekdayOf(k: DateKey): number {
  return parseKey(k).getDay();
}

/** "Thursday" */
export function weekdayName(weekday: number): string {
  return LDOW[weekday];
}

/** Monday of the week containing `k` (weeks are Monday-first). */
export function startOfWeek(k: DateKey): DateKey {
  return addDays(k, -((parseKey(k).getDay() + 6) % 7));
}

export function weekDays(k: DateKey): DateKey[] {
  const mon = startOfWeek(k);
  return [0, 1, 2, 3, 4, 5, 6].map((i) => addDays(mon, i));
}

/**
 * Month grid cells, Monday-first, padded with nulls to whole weeks.
 * `month` is 0-based like Date.
 */
export function monthGrid(year: number, month: number): (DateKey | null)[] {
  const first = (new Date(year, month, 1).getDay() + 6) % 7;
  const days = new Date(year, month + 1, 0).getDate();
  const total = Math.ceil((first + days) / 7) * 7;
  return Array.from({ length: total }, (_, i) => {
    const d = i - first + 1;
    return d < 1 || d > days ? null : toKey(new Date(year, month, d, 12));
  });
}

/** "Thu, Oct 8" */
export function formatShortDay(k: DateKey): string {
  const d = parseKey(k);
  return `${DOW[d.getDay()]}, ${MON[d.getMonth()]} ${d.getDate()}`;
}

/** "Oct 8" */
export function formatMonthDay(k: DateKey): string {
  const d = parseKey(k);
  return `${MON[d.getMonth()]} ${d.getDate()}`;
}

/** "Thursday, October 8" */
export function formatLongDay(k: DateKey): string {
  const d = parseKey(k);
  return `${LDOW[d.getDay()]}, ${LMON[d.getMonth()]} ${d.getDate()}`;
}

/** "October 2026" */
export function formatMonthYear(year: number, month: number): string {
  return `${LMON[month]} ${year}`;
}
