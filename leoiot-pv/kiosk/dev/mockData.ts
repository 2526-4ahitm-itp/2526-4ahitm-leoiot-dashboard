// Beispieldaten für den Mock-Modus (reine Funktionen, keine Vite-Importe).
import type { Counters } from '@leoiot-pv/shared/energy';

const HOUR_MS = 3_600_000;
const SLOT_MS = 5 * 60_000;

/** Stand, der "jetzt" zu sehen sein soll. */
const TARGET: Counters = { yield: 746.2, exported: 0, imported: 207, charged: 82.4, discharged: 141.2 };

const KEYS = ['yield', 'exported', 'imported', 'charged', 'discharged'] as const;

// Tabellenreihenfolge wie in der echten Antwort
const TABLES = ['daily_charged', 'daily_discharged', 'daily_exported', 'daily_imported', 'daily_yield'] as const;
const FIELD_KEY: Record<(typeof TABLES)[number], keyof Counters> = {
  daily_charged: 'charged',
  daily_discharged: 'discharged',
  daily_exported: 'exported',
  daily_imported: 'imported',
  daily_yield: 'yield',
};

// Weicher Anstieg von 0 auf 1 zwischen a und b
function ramp(h: number, a: number, b: number): number {
  const x = Math.min(1, Math.max(0, (h - a) / (b - a)));
  return x * x * (3 - 2 * x);
}

// Verlauf des Tages je Zähler (0 bis 1)
const FORM: Record<keyof Counters, (h: number) => number> = {
  yield: (h) => ramp(h, 6.5, 18.5),
  exported: () => 0,
  imported: (h) => 0.45 * ramp(h, 0, 7) + 0.1 * ramp(h, 7, 17) + 0.45 * ramp(h, 17, 24),
  charged: (h) => ramp(h, 9.5, 13.5),
  discharged: (h) => 0.6 * ramp(h, 0, 6.5) + 0.4 * ramp(h, 18.5, 24),
};

/** Zählerstand des Beispieltags zu einem Zeitpunkt (Stunden seit Tagesbeginn, 0 bis 24). */
export function mockCounters(hour: number, nowHour: number): Counters {
  const h = Math.min(hour, nowHour); // nach "jetzt" bleibt der Stand stehen
  const out = {} as Counters;
  for (const k of KEYS) {
    const base = FORM[k](nowHour);
    out[k] = base === 0 ? 0 : Math.round((TARGET[k] * FORM[k](h)) / base * 10) / 10;
  }
  return out;
}

const HEADER = ',result,table,_start,_stop,_time,_value,_field,_measurement,plant_id';

interface Entry {
  t: Date;
  counters: Counters;
}

// Alle Zeilen einer Tabelle hintereinander, am Ende eine Leerzeile
function toCsv(start: Date, stop: Date, entries: Entry[]): string {
  const lines = [HEADER];
  TABLES.forEach((field, table) => {
    for (const e of entries) {
      lines.push(
        `,_result,${table},${start.toISOString()},${stop.toISOString()},${e.t.toISOString()},${e.counters[FIELD_KEY[field]]},${field},solax_stats,mock`,
      );
    }
  });
  return lines.join('\r\n') + '\r\n\r\n';
}

/** CSV wie von der Tagesabfrage: letzter Stand je 5-Minuten-Fenster von start bis höchstens `until`. */
export function mockTodayCsv(start: Date, until: Date): string {
  if (until.getTime() <= start.getTime()) return '\r\n';
  const nowHour = (until.getTime() - start.getTime()) / HOUR_MS;
  const entries: Entry[] = [];
  for (let w = start.getTime(); w < until.getTime(); w += SLOT_MS) {
    const t = Math.min(w + 4.5 * 60_000, until.getTime());
    entries.push({ t: new Date(t), counters: mockCounters((t - start.getTime()) / HOUR_MS, nowHour) });
  }
  return toCsv(start, new Date(start.getTime() + 24 * HOUR_MS), entries);
}

// Feste Endstände früherer Tage: yield, exported, imported, charged, discharged
const PAST: Counters[] = [
  [612.4, 35.2, 251.3, 96.0, 120.5],
  [188.9, 0, 402.7, 12.1, 88.4],
  [540.0, 120.6, 180.2, 101.3, 97.7],
  [705.3, 60.1, 260.9, 110.0, 131.2],
  [820.6, 15.4, 240.0, 118.8, 150.3],
  [430.0, 22.0, 310.5, 64.2, 101.9],
].map(([y, e, i, c, d]) => ({ yield: y, exported: e, imported: i, charged: c, discharged: d }));

/** CSV wie von der Wochenabfrage: ein Stand je Tag; der letzte Tag ist heute mit dem Stand von `until`. */
export function mockWeekCsv(dayStarts: Date[], until: Date): string {
  if (dayStarts.length === 0) return '\r\n';
  const last = dayStarts[dayStarts.length - 1];
  const nowHour = (until.getTime() - last.getTime()) / HOUR_MS;
  const entries: Entry[] = dayStarts.map((t, i) => ({
    t,
    counters: i === dayStarts.length - 1 ? mockCounters(nowHour, nowHour) : PAST[i % PAST.length],
  }));
  return toCsv(dayStarts[0], new Date(last.getTime() + 24 * HOUR_MS), entries);
}

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

/** Live-Nachricht mit Momentanleistung (Form A) als JSON-Text. */
export function mockPowerMessage(now: Date, dayStart: Date): string {
  const h = (now.getTime() - dayStart.getTime()) / HOUR_MS;
  const pv = h >= 6.5 && h <= 18.5 ? 95 * Math.max(0, Math.sin((Math.PI * (h - 6.5)) / 12)) : 0;
  const load = Math.max(30, 62 + 14 * Math.sin((Math.PI * (h - 5)) / 9));
  const battery = pv > load + 12 ? -12 : pv < 5 ? 10 : 0;
  const grid = load - pv - battery;
  return JSON.stringify({
    type: 'pv',
    data: {
      pv_power_kw: round1(pv),
      load_power_kw: round1(load),
      // Vorzeichen wie im echten Live-Kanal: negativ ist Bezug bzw. Entladen
      grid_power_kw: round1(-grid),
      battery_power_kw: round1(-battery),
      daily_pv_kwh: mockCounters(h, h).yield,
      _ts: now.getTime(),
    },
  });
}

/** Live-Nachricht mit Tageszählern (Form B, camelCase) als JSON-Text. */
export function mockCountersMessage(now: Date, dayStart: Date): string {
  const h = (now.getTime() - dayStart.getTime()) / HOUR_MS;
  const c = mockCounters(h, h);
  return JSON.stringify({
    type: 'pv',
    data: {
      dailyYield: c.yield,
      dailyExported: c.exported,
      dailyImported: c.imported,
      dailyCharged: c.charged,
      dailyDischarged: c.discharged,
      _ts: now.getTime(),
    },
  });
}
