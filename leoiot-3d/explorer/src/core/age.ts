// How current a room's values are (spec model3d/room-climate-view, "A room's
// values are current, stale or missing"; FSD FR-08).

export const STALE_AFTER_MS = 5 * 60_000;
/** The age of every value is judged again at least this often. */
export const REJUDGE_EVERY_MS = 10_000;

export type Freshness = 'current' | 'stale';

/** A reading is stale when its ts is more than 5 minutes before now; a ts in the future counts as current. */
export function freshness(ts: number, now: number): Freshness {
  return now - ts > STALE_AFTER_MS ? 'stale' : 'current';
}
