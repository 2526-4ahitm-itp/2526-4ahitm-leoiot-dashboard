// Flux-Abfragen des Films (nur Felder aus platform/data-contract).
import { BUCKET } from '@leoiot-pv/shared/influx';

/** Letzter Stand der Tagesproduktion je 10-Minuten-Fenster im Bereich. */
export function yieldQuery(start: Date, end: Date): string {
  return [
    `from(bucket: "${BUCKET}")`,
    `  |> range(start: ${start.toISOString()}, stop: ${end.toISOString()})`,
    '  |> filter(fn: (r) => r._measurement == "solax_stats" and r._field == "daily_yield")',
    '  |> window(every: 10m)',
    '  |> last()',
    '  |> window(every: inf)',
    '  |> keep(columns: ["_time", "_value"])',
  ].join('\n');
}

/** Jüngster gespeicherter Gesamtertrag. */
export function totalQuery(): string {
  return [
    `from(bucket: "${BUCKET}")`,
    '  |> range(start: -3d)',
    '  |> filter(fn: (r) => r._measurement == "solax_stats" and r._field == "total_yield")',
    '  |> last()',
    '  |> keep(columns: ["_time", "_value"])',
  ].join('\n');
}
