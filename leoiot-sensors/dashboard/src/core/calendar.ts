// The logic of the range calendar: month grids, the click rule, the state of a day and paging.
// Everything works on `YYYY-MM-DD` strings (calendar days, no time zones); "today" and the allowed
// span are passed in. No DOM here.
import { shiftDate } from './format';
import type { Lang } from './i18n';

/** What has been picked so far: nothing, a first day, or a first and a last day. */
export interface Pick {
  from: string | null;
  to: string | null;
}

export const NO_PICK: Pick = { from: null, to: null };

export interface Allowed {
  min: string;
  max: string;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Number of days of a month (month 1 to 12). */
export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** The weeks of a month, Monday first, each with seven entries: a `YYYY-MM-DD` day or null outside the month. */
export function monthGrid(year: number, month: number): (string | null)[][] {
  const lead = (new Date(Date.UTC(year, month - 1, 1)).getUTCDay() + 6) % 7;
  const days = daysInMonth(year, month);
  const cells: (string | null)[] = [...Array<null>(lead).fill(null)];
  for (let d = 1; d <= days; d++) cells.push(`${year}-${pad(month)}-${pad(d)}`);
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/**
 * The click rule. The first click sets the first day; a click on the same or a later day then sets
 * the last day; a click on an earlier day, or any click once the range is complete, starts again.
 */
export function pickDay(pick: Pick, day: string): Pick {
  if (pick.from !== null && pick.to === null && day >= pick.from) return { from: pick.from, to: day };
  return { from: day, to: null };
}

export type DayRole = 'start' | 'end' | 'single' | 'inside' | 'none';

export interface DayState {
  role: DayRole;
  /** The day is part of the hover preview, not of a picked range. */
  preview: boolean;
  /** Outside the allowed span: cannot be picked. */
  disabled: boolean;
  today: boolean;
}

/** The state of one day. With only a first day picked, `hover` previews the range up to the hovered day. */
export function dayState(day: string, pick: Pick, hover: string | null, allowed: Allowed, today: string): DayState {
  const disabled = day < allowed.min || day > allowed.max;
  let from = pick.from;
  let to = pick.to;
  let preview = false;
  if (from !== null && to === null && hover !== null && hover > from && !(hover < allowed.min || hover > allowed.max)) {
    to = hover;
    preview = true;
  }
  let role: DayRole = 'none';
  if (from !== null) {
    if (to === null || to === from) role = day === from ? 'single' : 'none';
    else if (day === from) role = 'start';
    else if (day === to) role = 'end';
    else if (day > from && day < to) role = 'inside';
  }
  if (role === 'none') preview = false;
  return { role, preview, disabled, today: day === today };
}

/** `YYYY-MM` of a day. */
export const monthOf = (day: string): string => day.slice(0, 7);

/** The month `n` months after (before, when negative) a `YYYY-MM` month. */
export function shiftMonth(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number);
  const total = y * 12 + (m - 1) + n;
  return `${Math.floor(total / 12)}-${pad((total % 12) + 1)}`;
}

/** The first and the last month that have an allowed day. */
export function monthLimits(allowed: Allowed): { first: string; last: string } {
  return { first: monthOf(allowed.min), last: monthOf(allowed.max) };
}

/**
 * Puts the month on the right of `count` shown months (1 or 2) in range: the leftmost month is not
 * before the first allowed month, the right one not after the last.
 */
export function clampRightMonth(right: string, count: number, allowed: Allowed): string {
  const { first, last } = monthLimits(allowed);
  const lowest = shiftMonth(first, count - 1);
  const wanted = right < lowest ? lowest : right;
  return wanted > last ? last : wanted;
}

/** The same day number `n` months on, cut to the length of that month. */
export function shiftDayByMonths(day: string, n: number): string {
  const month = shiftMonth(monthOf(day), n);
  const [y, m] = month.split('-').map(Number);
  return `${month}-${pad(Math.min(Number(day.slice(8, 10)), daysInMonth(y, m)))}`;
}

/** Monday of the week of a day. */
export function weekStart(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  return shiftDate(day, -((new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7));
}

export const weekEnd = (day: string): string => shiftDate(weekStart(day), 6);

export type Move = 'day' | 'week' | 'month' | 'year' | 'weekStart' | 'weekEnd';

/** Where the keyboard focus goes: `n` steps of a kind, kept inside the allowed span. */
export function moveFocus(day: string, move: Move, n: number, allowed: Allowed): string {
  const target =
    move === 'day' ? shiftDate(day, n)
    : move === 'week' ? shiftDate(day, 7 * n)
    : move === 'month' ? shiftDayByMonths(day, n)
    : move === 'year' ? shiftDayByMonths(day, 12 * n)
    : move === 'weekStart' ? weekStart(day)
    : weekEnd(day);
  return target < allowed.min ? allowed.min : target > allowed.max ? allowed.max : target;
}

/** Month heading, weekday names and full date for the labels; always in the page's language. */
export interface CalendarNames {
  /** `November 2026`. */
  month(month: string): string;
  /** `Montag, 16. November 2026` (de) or `Monday 16 November 2026` (en). */
  day(day: string): string;
}

export function calendarNames(lang: Lang): CalendarNames {
  const locale = lang === 'de' ? 'de-AT' : 'en-GB';
  const monthFmt = new Intl.DateTimeFormat(locale, { timeZone: 'UTC', month: 'long', year: 'numeric' });
  const dayFmt = new Intl.DateTimeFormat(locale, { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const at = (day: string) => {
    const [y, m, d] = day.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return {
    month: (month) => monthFmt.format(at(`${month}-01`)),
    day: (day) => dayFmt.format(at(day)),
  };
}
