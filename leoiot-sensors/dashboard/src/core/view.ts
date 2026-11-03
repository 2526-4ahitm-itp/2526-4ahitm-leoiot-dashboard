// From what is known (snapshot, history) and the clock to what the room panel shows. No DOM here.
import { airOf, LIMIT_BAD, LIMIT_SOON, sinceAbove, STALE_AFTER_MS, type Air, type CO2Point, type Since } from './air';
import type { Source } from './flux';
import { QUANTITIES, type Quantity, type Snapshot } from './snapshot';

export type RoomState =
  /** Nothing is known yet (queries running). */
  | 'loading'
  /** The room has no reading at all, or the room id is not valid. */
  | 'nodata'
  /** The stored readings could not be loaded and nothing else is known. */
  | 'error'
  /** The newest reading is more than five minutes old. */
  | 'stale'
  | 'live';

export interface RoomView {
  state: RoomState;
  /** The lit lamp; null when no lamp is lit (stale, no current CO2 value, nothing known). */
  air: Air | null;
  /** Fresh readings exist but none of CO2 within five minutes. */
  noCo2: boolean;
  source: Source | null;
  devices: string[];
  /** Per quantity the value to show, or null for unknown (shown as a dash, never as zero). */
  values: Record<Quantity, number | null>;
  /** Time of the newest reading and its age; null while nothing is known. */
  lastAt: number | null;
  ageMs: number | null;
  /** Since when CO2 has been above the limit of the lit lamp (yellow: 800, red: 1000). */
  since: Since | null;
}

export interface ViewInput {
  snapshot: Snapshot;
  /** Five-minute series of the last 24 hours (windows without readings are null). */
  series24h: readonly CO2Point[] | null;
  now: number;
  /** The room id broke the room id rule or the loading failed or is still running. */
  status: 'ok' | 'invalid' | 'loading' | 'error';
}

export function deriveRoomView(input: ViewInput): RoomView {
  const { snapshot, now } = input;
  const base: RoomView = {
    state: 'loading',
    air: null,
    noCo2: false,
    source: snapshot.source,
    devices: snapshot.devices,
    values: { co2: null, temperature: null, humidity: null },
    lastAt: snapshot.at,
    ageMs: snapshot.at === null ? null : Math.max(0, now - snapshot.at),
    since: null,
  };
  if (input.status === 'invalid') return { ...base, state: 'nodata', source: null, devices: [], lastAt: null, ageMs: null };
  if (snapshot.at === null) {
    if (input.status === 'error') return { ...base, state: 'error' };
    // Loading is over and nothing was found: the room has no reading at all.
    return { ...base, state: input.status === 'loading' ? 'loading' : 'nodata' };
  }

  const age = base.ageMs as number;
  const stale = age > STALE_AFTER_MS;
  const values = { co2: null, temperature: null, humidity: null } as RoomView['values'];
  for (const q of QUANTITIES) {
    const s = snapshot.samples[q];
    // An outdated page shows the last values greyed; a live page shows no value older than five minutes.
    if (s && (stale || now - s.at <= STALE_AFTER_MS)) values[q] = s.value;
  }
  if (stale) return { ...base, state: 'stale', values };

  const co2 = values.co2;
  if (co2 === null) return { ...base, state: 'live', values, noCo2: true };
  const air = airOf(co2);
  let since: Since | null = null;
  if (air !== 'good') {
    const at = (snapshot.samples.co2 as { at: number }).at;
    since = sinceAbove(input.series24h ?? [], air === 'bad' ? LIMIT_BAD : LIMIT_SOON, { at, value: co2 });
  }
  return { ...base, state: 'live', values, air, since };
}
