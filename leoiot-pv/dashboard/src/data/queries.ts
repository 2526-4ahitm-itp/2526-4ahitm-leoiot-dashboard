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

/** Zwischenspeicher je Monat ('YYYY-MM'); nur abgeschlossene Monate kommen hinein, sie ändern sich nicht mehr. */
export type MonthCache = Map<string, Record<string, PartialCounters>>;

/** Höchstens so viele Monatsabfragen laufen gleichzeitig (der Server hat zwei Kerne). */
export const MONTH_CONCURRENCY = 3;

/**
 * Wie loadDayTotals, aber je Monat eine Abfrage (gemessen am 2026-10-20 auf vm23: ein Jahr am Stück
 * rund 4 s, ein Monat rund 0,3 s). Monate ganz vor dem frühesten Wert oder nach heute werden nicht
 * abgefragt; abgeschlossene Monate kommen aus dem Zwischenspeicher, sobald sie einmal geladen sind.
 */
export async function loadDayTotalsByMonth(
  query: Query,
  days: string[],
  opts: { earliestKey: string | null; todayKey: string; cache: MonthCache },
): Promise<Record<string, PartialCounters>> {
  const months = new Map<string, string[]>();
  for (const d of days) {
    const m = d.slice(0, 7);
    if (!months.has(m)) months.set(m, []);
    months.get(m)!.push(d);
  }
  const jobs: (() => Promise<Record<string, PartialCounters>>)[] = [];
  for (const [m, list] of months) {
    const first = list[0];
    const last = list[list.length - 1];
    if (first > opts.todayKey) continue;
    if (opts.earliestKey !== null && last < opts.earliestKey) continue;
    const cached = opts.cache.get(m);
    if (cached) {
      jobs.push(async () => cached);
      continue;
    }
    jobs.push(async () => {
      const byDay = await loadDayTotals(query, list);
      if (last < opts.todayKey) opts.cache.set(m, byDay);
      return byDay;
    });
  }
  const out: Record<string, PartialCounters> = {};
  let next = 0;
  async function worker(): Promise<void> {
    while (next < jobs.length) {
      const job = jobs[next++];
      Object.assign(out, await job());
    }
  }
  await Promise.all(Array.from({ length: Math.min(MONTH_CONCURRENCY, jobs.length) }, worker));
  return out;
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
