// The air state from the CO2 value, and since when it has been above a limit.

export type Air = 'good' | 'soon' | 'bad';

/** From this value (ppm) the lamp is yellow. */
export const LIMIT_SOON = 800;
/** Above this value (ppm) the lamp is red. */
export const LIMIT_BAD = 1000;
/** A reading older than this is outdated (functional specification FR-08). */
export const STALE_AFTER_MS = 5 * 60_000;

/**
 * 799 is green, 800 and 1000 are yellow, 1001 is red. The value is rounded first, so that the
 * lamp always agrees with the number shown on the page (no decimals).
 */
export function airOf(co2: number): Air {
  const v = Math.round(co2);
  if (v > LIMIT_BAD) return 'bad';
  if (v >= LIMIT_SOON) return 'soon';
  return 'good';
}

/** Whether a (rounded) value counts as being over the limit: 800 and above, resp. above 1000. */
export function exceeds(limit: typeof LIMIT_SOON | typeof LIMIT_BAD, co2: number): boolean {
  const v = Math.round(co2);
  return limit === LIMIT_SOON ? v >= LIMIT_SOON : v > LIMIT_BAD;
}

/** The series is refreshed once a minute and its windows are five minutes wide. */
const MAX_SERIES_LAG_MS = 10 * 60_000;

export interface CO2Point {
  t: number;
  co2: number | null;
}

export interface Since {
  /** Time label of the first point of the current run (the time the chart plots it at). */
  at: number;
  /** The run reaches back to the start of the series: the real start is earlier. */
  beforeRange: boolean;
}

/**
 * The start of the current uninterrupted run above `limit`, read from the five-minute series
 * (points sorted by time, null for windows without readings). A gap ends a run. When the newest
 * window mean has not reached the limit yet but the current reading has, the run starts with the
 * current reading. Returns null when the current value is not above the limit.
 */
export function sinceAbove(
  points: readonly CO2Point[],
  limit: typeof LIMIT_SOON | typeof LIMIT_BAD,
  current: { at: number; value: number },
): Since | null {
  if (!exceeds(limit, current.value)) return null;
  let last = points.length - 1;
  while (last >= 0 && points[last].co2 === null) last--;
  // The newest window must be near the current reading, otherwise the series says nothing about it.
  if (last < 0 || Math.abs(current.at - points[last].t) > MAX_SERIES_LAG_MS || !exceeds(limit, points[last].co2 as number)) {
    return { at: current.at, beforeRange: false };
  }
  let first = last;
  while (first > 0) {
    const before = points[first - 1].co2;
    if (before === null || !exceeds(limit, before)) break;
    first--;
  }
  return { at: points[first].t, beforeRange: first === 0 };
}
