// What the page knows about the room right now: the newest value of each quantity with its time,
// where the values come from, and which device took them. Fed by the stored readings (latest query)
// and by live messages; per quantity the newer one wins, so the two sources never fight.
import type { CsvRecord } from './csv';
import { isSource, type Source } from './flux';

export type Quantity = 'co2' | 'temperature' | 'humidity';
export const QUANTITIES: readonly Quantity[] = ['co2', 'temperature', 'humidity'];

export interface Sample {
  value: number;
  /** Time the reading was taken, ms since the epoch. */
  at: number;
}

export interface Snapshot {
  samples: Partial<Record<Quantity, Sample>>;
  /** Source of the shown readings; null while nothing is known. */
  source: Source | null;
  devices: string[];
  /** Time of the newest sample; null while nothing is known. */
  at: number | null;
}

export const EMPTY_SNAPSHOT: Snapshot = { samples: {}, source: null, devices: [], at: null };

/** A number from a CSV cell: an empty cell is unknown (null), never zero. */
export function cellNumber(cell: string | undefined): number | null {
  if (cell === undefined || cell.trim() === '') return null;
  const n = Number(cell);
  return Number.isFinite(n) ? n : null;
}

function isQuantity(value: unknown): value is Quantity {
  return value === 'co2' || value === 'temperature' || value === 'humidity';
}

function newest(a: number | null, b: number | null): number | null {
  return a === null ? b : b === null ? a : Math.max(a, b);
}

/** The newest reading's source decides; only readings of that source count. */
export function parseLatest(records: readonly CsvRecord[]): Snapshot {
  const rows = records.flatMap((r) => {
    const at = Date.parse(r._time ?? '');
    const value = cellNumber(r._value);
    if (!Number.isFinite(at) || value === null || !isQuantity(r._field) || !isSource(r.source)) return [];
    return [{ at, value, field: r._field, source: r.source, device: r.device ?? '' }];
  });
  if (rows.length === 0) return EMPTY_SNAPSHOT;
  const top = rows.reduce((a, b) => (b.at > a.at ? b : a));
  const shown = rows.filter((r) => r.source === top.source);
  const samples: Snapshot['samples'] = {};
  for (const r of shown) {
    const s = samples[r.field];
    if (!s || r.at > s.at) samples[r.field] = { value: r.value, at: r.at };
  }
  // Devices that took the newest values (within the same freshness window), not every device ever seen.
  const devices = [...new Set(shown.filter((r) => top.at - r.at <= 5 * 60_000 && r.device !== '').map((r) => r.device))].sort();
  return { samples, source: top.source, devices, at: top.at };
}

/** A parsed live message of the contract (`leoiot/room-climate/<room>`). */
export interface LiveReading {
  room: string;
  device: string;
  source: Source;
  ts: number;
  co2?: number;
  temperature?: number;
  humidity?: number;
}

/** Merges stored latest values into the snapshot: per quantity the newer sample wins. */
export function mergeSnapshots(current: Snapshot, incoming: Snapshot): Snapshot {
  if (incoming.at === null) return current;
  if (current.at === null) return incoming;
  if (incoming.source !== current.source) return incoming.at > current.at ? incoming : current;
  const samples: Snapshot['samples'] = { ...current.samples };
  for (const q of QUANTITIES) {
    const s = incoming.samples[q];
    if (s && (!samples[q] || s.at >= (samples[q] as Sample).at)) samples[q] = s;
  }
  const incomingNewer = incoming.at >= current.at;
  return {
    samples,
    source: current.source,
    devices: incomingNewer ? incoming.devices : current.devices,
    at: newest(current.at, incoming.at),
  };
}

/** A live message becomes a snapshot of the values it carries, all stamped with its `ts`. */
export function snapshotOfLive(msg: LiveReading): Snapshot {
  const samples: Snapshot['samples'] = {};
  for (const q of QUANTITIES) {
    const value = msg[q];
    if (typeof value === 'number') samples[q] = { value, at: msg.ts };
  }
  return { samples, source: msg.source, devices: msg.device ? [msg.device] : [], at: msg.ts };
}

export function applyLive(current: Snapshot, msg: LiveReading): Snapshot {
  return mergeSnapshots(current, snapshotOfLive(msg));
}

/** One window of the history: `null` is "no readings", never zero. */
export interface HistoryPoint {
  t: number;
  co2: number | null;
  temperature: number | null;
  humidity: number | null;
}

/** Rows of the pivoted history query, sorted by time. Rows without a usable time are dropped. */
export function parseHistory(records: readonly CsvRecord[]): HistoryPoint[] {
  const points: HistoryPoint[] = [];
  for (const r of records) {
    const t = Date.parse(r._time ?? '');
    if (!Number.isFinite(t)) continue;
    points.push({ t, co2: cellNumber(r.co2), temperature: cellNumber(r.temperature), humidity: cellNumber(r.humidity) });
  }
  return points.sort((a, b) => a.t - b.t);
}
