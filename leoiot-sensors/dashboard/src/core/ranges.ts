// The two time ranges: the last 24 hours (five-minute means) and the last 7 days (thirty-minute means).

export type RangeId = '24h' | '7d';

export interface RangeSpec {
  spanMs: number;
  /** Flux duration of the aggregation window. */
  every: '5m' | '30m';
  everyMs: number;
}

const HOUR = 3_600_000;

export const RANGES: Record<RangeId, RangeSpec> = {
  '24h': { spanMs: 24 * HOUR, every: '5m', everyMs: 5 * 60_000 },
  '7d': { spanMs: 7 * 24 * HOUR, every: '30m', everyMs: 30 * 60_000 },
};

export const DEFAULT_RANGE: RangeId = '24h';

export function isRangeId(value: unknown): value is RangeId {
  return value === '24h' || value === '7d';
}

/** Both ranges end now (whole seconds) and reach back by their span. */
export function rangeBounds(range: RangeId, now: number): { start: number; end: number } {
  const end = Math.floor(now / 1000) * 1000;
  return { start: end - RANGES[range].spanMs, end };
}
