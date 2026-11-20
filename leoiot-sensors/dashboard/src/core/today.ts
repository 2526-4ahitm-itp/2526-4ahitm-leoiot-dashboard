// The summary of the current day: time above 1000 ppm, the highest value and the estimated last
// airing, from the five-minute series, one peak query and one query counting minutes above 1000 ppm. Pure, no DOM.
import { exceeds, LIMIT_BAD, type CO2Point } from './air';
import type { CsvRecord } from './csv';
import { cellNumber } from './snapshot';

export const WINDOW_MS = 5 * 60_000;

/*
 * Design parameters of the airing estimate, not health limits: CO2 falling by at least this much
 * within this many windows (three windows of five minutes = fifteen minutes) counts as airing.
 * They can be tuned here after a few weeks of real data.
 */
export const AIRING_DROP_PPM = 200;
export const AIRING_WITHIN_WINDOWS = 3;

/** The highest single CO2 reading since local midnight. */
export interface Peak {
  value: number;
  at: number;
}

export interface TodayView {
  /** No CO2 reading at all today. */
  empty: boolean;
  /** Whole minutes above 1000 ppm (stored readings), at least 1 when today's peak is above 1000 ppm. */
  aboveMinutes: number;
  peak: Peak | null;
  /** Start (window time) of the latest fall that looks like airing; null if none was detected. */
  airedAt: number | null;
}

/** Windows of today: the window's time is its end, so a window ending at midnight is still yesterday's. */
export function todaysWindows(points: readonly CO2Point[], midnight: number, now: number): CO2Point[] {
  return points.filter((p) => p.t > midnight && p.t <= now);
}

/** The latest window i with a later window j (i < j <= i + 3, five minutes apart) at least 200 ppm lower. */
export function lastAiring(windows: readonly CO2Point[]): number | null {
  for (let i = windows.length - 1; i >= 0; i--) {
    const a = windows[i];
    if (a.co2 === null) continue;
    for (let j = i + 1; j < windows.length && windows[j].t - a.t <= AIRING_WITHIN_WINDOWS * WINDOW_MS; j++) {
      const b = windows[j].co2;
      if (b !== null && b <= a.co2 - AIRING_DROP_PPM) return a.t;
    }
  }
  return null;
}

export function deriveToday(points: readonly CO2Point[], peak: Peak | null, storedMinutes: number, midnight: number, now: number): TodayView {
  const windows = todaysWindows(points, midnight, now);
  const any = windows.some((p) => p.co2 !== null);
  return {
    empty: !any && peak === null,
    aboveMinutes: peak !== null && exceeds(LIMIT_BAD, peak.value) ? Math.max(storedMinutes, 1) : storedMinutes,
    peak,
    airedAt: lastAiring(windows),
  };
}

/**
 * The higher of the stored peak and the current reading, when that reading was taken today. The
 * stored peak lags up to a minute behind live messages, and a room whose history has not caught up
 * yet must not say "no readings today" next to a current value.
 */
export function withCurrent(peak: Peak | null, current: Peak | undefined, midnight: number): Peak | null {
  if (!current || current.at <= midnight) return peak;
  return peak === null || current.value > peak.value ? current : peak;
}

/** The answer of the peak query: one row (more are tolerated, the highest wins); no row is no reading. */
export function parsePeak(records: readonly CsvRecord[]): Peak | null {
  let best: Peak | null = null;
  for (const r of records) {
    const at = Date.parse(r._time ?? '');
    const value = cellNumber(r._value);
    if (!Number.isFinite(at) || value === null) continue;
    if (best === null || value > best.value) best = { value, at };
  }
  return best;
}

/**
 * The answer of the minutes query: one row with the count; no row (or no readable count) is 0. More
 * rows are tolerated, the highest count wins.
 */
export function parseAboveMinutes(records: readonly CsvRecord[]): number {
  let best = 0;
  for (const r of records) {
    const n = cellNumber(r._value);
    if (n !== null && n > best) best = Math.floor(n);
  }
  return best;
}
