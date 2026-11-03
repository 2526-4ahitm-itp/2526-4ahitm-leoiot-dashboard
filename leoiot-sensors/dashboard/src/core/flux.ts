// The Flux queries (design D10). Only fixed text plus the room id and the source go into them, and
// both are checked here, whatever the caller did before.
import { assertRoomId } from './room';
import { RANGES, rangeBounds, type RangeId } from './ranges';

export const BUCKET = 'server_data';
export const MEASUREMENT = 'room_climate';
export const SOURCES = ['sensor', 'simulated'] as const;
export type Source = (typeof SOURCES)[number];

export function isSource(value: unknown): value is Source {
  return value === 'sensor' || value === 'simulated';
}

/** How far back the latest values are searched; a room silent for longer counts as without data. */
export const LATEST_LOOKBACK = '30d';

const FIELDS = `r._field == "co2" or r._field == "temperature" or r._field == "humidity"`;

/**
 * The newest value of each field per series (device and source), with its time and tags. The caller
 * picks the newest reading overall and takes its source as the source of the shown readings.
 */
export function latestQuery(room: string): string {
  assertRoomId(room);
  return [
    `from(bucket: "${BUCKET}")`,
    `  |> range(start: -${LATEST_LOOKBACK})`,
    `  |> filter(fn: (r) => r._measurement == "${MEASUREMENT}" and r.room == "${room}")`,
    `  |> filter(fn: (r) => ${FIELDS})`,
    `  |> last()`,
    `  |> keep(columns: ["_time", "_value", "_field", "device", "source"])`,
  ].join('\n');
}

/**
 * Means of fixed windows (five minutes for 24 h, thirty for 7 days), all devices of the room and
 * source merged, empty windows kept so that they come back as gaps, one row per window with the
 * fields as columns. The window's time is its end.
 */
export function historyQuery(room: string, source: Source, range: RangeId, now: number): string {
  assertRoomId(room);
  if (!isSource(source)) throw new Error('invalid source');
  const { start, end } = rangeBounds(range, now);
  const iso = (ms: number) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');
  return [
    `from(bucket: "${BUCKET}")`,
    `  |> range(start: ${iso(start)}, stop: ${iso(end)})`,
    `  |> filter(fn: (r) => r._measurement == "${MEASUREMENT}" and r.room == "${room}" and r.source == "${source}")`,
    `  |> filter(fn: (r) => ${FIELDS})`,
    `  |> keep(columns: ["_start", "_stop", "_time", "_value", "_field"])`,
    `  |> group(columns: ["_field"])`,
    `  |> aggregateWindow(every: ${RANGES[range].every}, fn: mean, createEmpty: true)`,
    `  |> pivot(rowKey: ["_time"], columnKey: ["_field"], valueColumn: "_value")`,
  ].join('\n');
}
