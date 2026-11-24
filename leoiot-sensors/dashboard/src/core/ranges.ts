// What the charts show: the last 24 hours, the last 7 days (both ending now) or chosen days.
// A selection becomes bounds (start, end), an averaging window and a live flag.
import { localDate, localMidnight, shiftDate } from './format';

export type RangeId = '24h' | '7d';
export type Selection = { kind: '24h' } | { kind: '7d' } | { kind: 'dates'; from: string; to: string };
/** Flux duration of the averaging window. */
export type Every = '5m' | '30m' | '4h' | '1d';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

export const DEFAULT_RANGE: RangeId = '24h';

export function isRangeId(value: unknown): value is RangeId {
  return value === '24h' || value === '7d';
}

/** Averaging window for a span: up to 2 days, 14 days, 93 days; beyond that one day. */
export const WINDOW_TABLE: readonly { maxDays: number; every: Every; everyMs: number }[] = [
  { maxDays: 2, every: '5m', everyMs: 5 * 60_000 },
  { maxDays: 14, every: '30m', everyMs: 30 * 60_000 },
  { maxDays: 93, every: '4h', everyMs: 4 * HOUR },
  { maxDays: Infinity, every: '1d', everyMs: DAY },
];

/** Key of a selection, for the history states. */
export function selectionKey(sel: Selection): string {
  return sel.kind === 'dates' ? `dates:${sel.from}:${sel.to}` : sel.kind;
}

/** The instants a selection covers. Ranges ending now end at whole seconds; a chosen range ends at local midnight after its last day, capped at now. */
export function selectionBounds(sel: Selection, now: number): { start: number; end: number } {
  const end = Math.floor(now / 1000) * 1000;
  if (sel.kind === '24h') return { start: end - DAY, end };
  if (sel.kind === '7d') return { start: end - 7 * DAY, end };
  return { start: localMidnight(sel.from), end: Math.min(localMidnight(shiftDate(sel.to, 1)), end) };
}

/** Calendar days of a chosen range, first and last day included (a DST day counts as one day). */
export function dayCount(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY) + 1;
}

export function selectionWindow(sel: Selection, _now: number): { every: Every; everyMs: number } {
  const days = sel.kind === 'dates' ? dayCount(sel.from, sel.to) : 0;
  const row = sel.kind === '24h' ? WINDOW_TABLE[0] : sel.kind === '7d' ? WINDOW_TABLE[1] : WINDOW_TABLE.find((r) => days <= r.maxDays)!;
  return { every: row.every, everyMs: row.everyMs };
}

/** True when the range keeps growing: 24 h, 7 days and chosen dates whose last day is today. */
export function isLive(sel: Selection, now: number): boolean {
  return sel.kind !== 'dates' || sel.to >= localDate(now);
}

/** The days that can be chosen: from the same day of the month 13 months back (clamped) up to today. */
export function allowedDates(now: number): { min: string; max: string } {
  const max = localDate(now);
  const [y, m, d] = max.split('-').map(Number);
  const months = y * 12 + (m - 1) - 13;
  const ny = Math.floor(months / 12);
  const nm = months % 12;
  const last = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate();
  const pad = (n: number) => String(n).padStart(2, '0');
  return { min: `${ny}-${pad(nm + 1)}-${pad(Math.min(d, last))}`, max };
}

const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;

export type DatesCheck = 'ok' | 'invalid' | 'order' | 'span';

export function validateDates(from: string, to: string, now: number): DatesCheck {
  if (!isDate(from) || !isDate(to)) return 'invalid';
  if (from > to) return 'order';
  const { min, max } = allowedDates(now);
  return from < min || to > max ? 'span' : 'ok';
}
