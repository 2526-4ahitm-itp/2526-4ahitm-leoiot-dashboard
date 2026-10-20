// Dünne Ladefunktionen: Abfrage über eine übergebene query-Funktion, Auswertung mit dem gemeinsamen Code.
import type { Counters, PartialCounters } from '@leoiot-pv/shared/energy';
import {
  BUCKET,
  earliestQuery,
  parseEarliest,
  parseToday,
  parseWeek,
  powerSeries,
  todayQuery,
  validRows,
  weekQuery,
  type CounterRow,
  type PowerPoint,
} from '@leoiot-pv/shared/influx';
import { yieldPower } from '../core/yieldCurve';
import { addDays, slotCount, viennaDateKey, viennaDayStart } from '@leoiot-pv/shared/time';

export type Query = (flux: string) => Promise<string>;

/** Letzter Zählerstand je Wiener Tag für die gegebenen Tage (aufsteigend, mindestens einer). */
export async function loadDayTotals(query: Query, days: string[]): Promise<Record<string, PartialCounters>> {
  if (days.length === 0) return {};
  const csv = await query(weekQuery(viennaDayStart(days[0]), viennaDayStart(addDays(days[days.length - 1], 1))));
  return parseWeek(csv);
}

/** Wiener Tag des frühesten gespeicherten Produktionswerts; null, wenn nichts gespeichert ist. */
export async function loadEarliest(query: Query): Promise<string | null> {
  const at = parseEarliest(await query(earliestQuery()));
  return at === null ? null : viennaDateKey(at);
}

/** Zählerstände, Leistungskurve und Fensteranzahl eines Tages. */
export async function loadDayCurve(
  query: Query,
  key: string,
  yesterday: Counters | null,
): Promise<{ rows: CounterRow[]; power: PowerPoint[]; slots: number }> {
  const start = viennaDayStart(key);
  const csv = await query(todayQuery(start, viennaDayStart(addDays(key, 1))));
  const rows = validRows(parseToday(csv), start, yesterday);
  // ohne vollständige Zählerstände nur die Produktionskurve
  const power = rows.length > 0 ? powerSeries(rows, start) : yieldPower(csv, start);
  return { rows, power, slots: slotCount(key) };
}

/** Zeitpunkt (ms) des jüngsten gespeicherten Produktionswerts der letzten Tage; null, wenn keiner da ist. */
export async function loadLatest(query: Query, now: number = Date.now()): Promise<number | null> {
  const csv = await query(
    [
      `from(bucket: "${BUCKET}")`,
      `  |> range(start: ${new Date(now - 7 * 86_400_000).toISOString()})`,
      '  |> filter(fn: (r) => r._measurement == "solax_stats")',
      '  |> filter(fn: (r) => r._field == "daily_yield")',
      '  |> last()',
      '  |> group()',
      '  |> sort(columns: ["_time"], desc: true)',
      '  |> limit(n: 1)',
    ].join('\n'),
  );
  return parseEarliest(csv)?.getTime() ?? null;
}
