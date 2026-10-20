// Dünne Ladefunktionen: Abfrage über eine übergebene query-Funktion, Auswertung mit dem gemeinsamen Code.
import type { Counters, PartialCounters } from '@leoiot-pv/shared/energy';
import {
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
  return { rows, power: powerSeries(rows, start), slots: slotCount(key) };
}
