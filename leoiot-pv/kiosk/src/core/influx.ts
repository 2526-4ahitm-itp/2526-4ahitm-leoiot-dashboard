// Abfragen an die InfluxDB und Auswertung der CSV-Antworten (reine Funktionen).
import { completeCounters, powerBetween, type Counters, type PartialCounters, type Power } from './energy';
import { SLOT_MS, viennaDateKey } from './time';

export const BUCKET = 'server_data';

const MINUTE_MS = 60_000;
const HOUR_MS = 3_600_000;

const FIELD_FILTER =
  'r._field == "daily_yield" or r._field == "daily_exported" or r._field == "daily_imported" or r._field == "daily_charged" or r._field == "daily_discharged"';

const FIELD_MAP: Record<string, keyof Counters> = {
  daily_yield: 'yield',
  daily_exported: 'exported',
  daily_imported: 'imported',
  daily_charged: 'charged',
  daily_discharged: 'discharged',
};

/** Flux-Abfrage: letzter Zählerstand je 5-Minuten-Fenster im Bereich. */
export function todayQuery(start: Date, end: Date): string {
  return [
    `from(bucket: "${BUCKET}")`,
    `  |> range(start: ${start.toISOString()}, stop: ${end.toISOString()})`,
    '  |> filter(fn: (r) => r._measurement == "solax_stats")',
    `  |> filter(fn: (r) => ${FIELD_FILTER})`,
    '  |> window(every: 5m)',
    '  |> last()',
    '  |> window(every: inf)',
  ].join('\n');
}

/** Flux-Abfrage: letzter Zählerstand je Wiener Kalendertag im Bereich. */
export function weekQuery(start: Date, end: Date): string {
  return [
    'import "timezone"',
    'option location = timezone.location(name: "Europe/Vienna")',
    `from(bucket: "${BUCKET}")`,
    `  |> range(start: ${start.toISOString()}, stop: ${end.toISOString()})`,
    '  |> filter(fn: (r) => r._measurement == "solax_stats")',
    `  |> filter(fn: (r) => ${FIELD_FILTER})`,
    '  |> aggregateWindow(every: 1d, fn: last, createEmpty: false, timeSrc: "_start")',
  ].join('\n');
}

/** CSV einer Flux-Antwort als Liste von Zeilenobjekten (Spaltenname -> Text). */
export function parseCsv(text: string): Record<string, string>[] {
  const out: Record<string, string>[] = [];
  let header: string[] | null = null;
  for (const line of text.split(/\r?\n/)) {
    if (line === '') {
      header = null; // Leerzeile beendet den Block
      continue;
    }
    if (line.startsWith('#')) continue;
    const cells = line.split(',');
    if (header === null) {
      header = cells;
      continue;
    }
    const row: Record<string, string> = {};
    header.forEach((name, i) => {
      if (name !== '') row[name] = cells[i] ?? '';
    });
    out.push(row);
  }
  return out;
}

/** Ein vollständiger Zählerstand; t ist die Messzeit in ms. */
export interface CounterRow {
  t: number;
  counters: Counters;
}

interface Sample {
  t: number;
  key: keyof Counters;
  value: number;
}

// Gültige Messwerte aus den CSV-Zeilen; alles andere wird ignoriert.
function samples(csv: string): Sample[] {
  const out: Sample[] = [];
  for (const row of parseCsv(csv)) {
    const key = FIELD_MAP[row._field];
    if (!key) continue;
    const value = row._value === undefined || row._value === '' ? NaN : Number(row._value);
    const t = Date.parse(row._time);
    if (!Number.isFinite(value) || !Number.isFinite(t)) continue;
    out.push({ t, key, value });
  }
  return out;
}

/** Zählerstände je 5-Minuten-Fenster, aufsteigend; unvollständige Fenster entfallen. */
export function parseToday(csv: string): CounterRow[] {
  const slots = new Map<number, { t: number; fields: PartialCounters }>();
  for (const s of samples(csv)) {
    const slot = Math.floor(s.t / SLOT_MS);
    let entry = slots.get(slot);
    if (!entry) {
      entry = { t: s.t, fields: {} };
      slots.set(slot, entry);
    }
    entry.fields[s.key] = s.value;
    if (s.t > entry.t) entry.t = s.t;
  }
  const rows: CounterRow[] = [];
  for (const { t, fields } of slots.values()) {
    const counters = completeCounters(fields);
    if (counters) rows.push({ t, counters });
  }
  return rows.sort((a, b) => a.t - b.t);
}

/** Zählerstände je Wiener Kalendertag ('YYYY-MM-DD'); Felder können fehlen. */
export function parseWeek(csv: string): Record<string, PartialCounters> {
  const days: Record<string, PartialCounters> = {};
  for (const s of samples(csv)) {
    const day = viennaDateKey(new Date(s.t));
    (days[day] ??= {})[s.key] = s.value;
  }
  return days;
}

const KEYS: (keyof Counters)[] = ['yield', 'exported', 'imported', 'charged', 'discharged'];

const sumOf = (c: Counters): number => KEYS.reduce((acc, k) => acc + c[k], 0);

// Zähler-Reset des Tages: Rückgang, der in den ersten 30 Minuten liegt oder die Zählersumme mehr als halbiert.
// Kurze Rücksprünge einzelner Zähler im Tagesverlauf sind kein Reset.
function isDayReset(prev: CounterRow, next: CounterRow, dayStart: Date): boolean {
  if (powerBetween(prev.counters, next.counters, 1) !== null) return false;
  return next.t < dayStart.getTime() + 30 * MINUTE_MS || sumOf(next.counters) < sumOf(prev.counters) / 2;
}

/** Liest jeden Zähler als sein bisheriges Tagesmaximum; liefert neue Zeilen, die Eingabe bleibt unverändert. */
export function monotoneRows(rows: CounterRow[]): CounterRow[] {
  const max = {} as Counters;
  return rows.map((row, i) => {
    const counters = {} as Counters;
    for (const k of KEYS) {
      max[k] = i === 0 ? row.counters[k] : Math.max(max[k], row.counters[k]);
      counters[k] = max[k];
    }
    return { t: row.t, counters };
  });
}

/** Entfernt Stände am Tagesanfang, die noch zum Vortag gehören. */
export function validRows(rows: CounterRow[], dayStart: Date, yesterday: Counters | null): CounterRow[] {
  let from = 0;
  // 1. Letzter Zähler-Reset in der Reihe: alles davor verwerfen
  for (let i = rows.length - 1; i >= 1; i--) {
    if (isDayReset(rows[i - 1], rows[i], dayStart)) {
      from = i;
      break;
    }
  }
  // 2. Noch nicht zurückgesetzte Endstände von gestern am Tagesanfang verwerfen
  if (yesterday !== null) {
    const sum = KEYS.reduce((acc, k) => acc + yesterday[k], 0);
    if (sum > 0) {
      const limit = dayStart.getTime() + 30 * MINUTE_MS;
      while (
        from < rows.length &&
        rows[from].t < limit &&
        KEYS.every((k) => rows[from].counters[k] >= yesterday[k] - 0.05)
      ) {
        from++;
      }
    }
  }
  return rows.slice(from);
}

/** Ein Punkt der Leistungskurve in kW; null bedeutet Lücke. */
export interface PowerPoint {
  t: number;
  production: number | null;
  consumption: number | null;
}

/** Leistungskurve aus den Differenzen aufeinanderfolgender Zählerstände. */
export function powerSeries(rawRows: CounterRow[], dayStart: Date): PowerPoint[] {
  if (rawRows.length === 0) return [];
  const rows = monotoneRows(rawRows); // Rücksprünge einzelner Zähler ergeben keine Lücke und keine Spitze
  const zero: Counters = { yield: 0, exported: 0, imported: 0, charged: 0, discharged: 0 };
  const stands: CounterRow[] =
    rows[0].t - dayStart.getTime() <= 15 * MINUTE_MS ? [{ t: dayStart.getTime(), counters: zero }, ...rows] : rows;
  const points: PowerPoint[] = [];
  for (let i = 1; i < stands.length; i++) {
    const prev = stands[i - 1];
    const next = stands[i];
    const dt = next.t - prev.t;
    const p = dt > 15 * MINUTE_MS || dt <= 0 ? null : powerBetween(prev.counters, next.counters, dt / HOUR_MS);
    points.push(
      p === null
        ? { t: next.t, production: null, consumption: null }
        : { t: next.t, production: p.pv, consumption: Math.abs(p.load) },
    );
  }
  return points;
}

/** Mittlere Leistung der letzten rund zehn Minuten; null, wenn dafür Stände fehlen. */
export function averagePower(rawRows: CounterRow[]): { power: Power; t: number } | null {
  if (rawRows.length === 0) return null;
  const rows = monotoneRows(rawRows);
  const last = rows[rows.length - 1];
  let ref: CounterRow | null = null;
  for (let i = rows.length - 1; i >= 0; i--) {
    if (last.t - rows[i].t >= 9 * MINUTE_MS) {
      ref = rows[i];
      break;
    }
  }
  if (!ref || last.t - ref.t > 20 * MINUTE_MS) return null;
  const p = powerBetween(ref.counters, last.counters, (last.t - ref.t) / HOUR_MS);
  return p === null ? null : { power: p, t: last.t };
}
