// Aus den gespeicherten Produktionsständen wird die Landschaft: je Tag eine Reihe von Leistungswerten (reine Funktionen).
import { validRows, type CounterRow } from '@leoiot-pv/shared/influx';
import { addDays, viennaDateKey, viennaDayStart } from '@leoiot-pv/shared/time';
import type { Counters } from '@leoiot-pv/shared/energy';

/** Erstes und letztes Fenster des Tages, das gezeigt wird: 04:00 bis 20:40, je zehn Minuten. */
export const FIRST_MINUTE = 240;
export const LAST_MINUTE = 1240;
export const WINDOW_MIN = 10;
export const COLS = (LAST_MINUTE - FIRST_MINUTE) / WINDOW_MIN + 1;

/** Höchstens so lange darf zwischen zwei Ständen liegen, damit daraus eine Leistung wird. */
const MAX_GAP_MS = 25 * 60_000;

export interface Day {
  key: string; // 'YYYY-MM-DD', Wiener Tag
  /** Leistung in kW je Fenster; NaN = für dieses Fenster gibt es keinen Messwert. */
  power: Float32Array;
  /** Produktion des Tages in kWh; null = keine Messwerte. */
  energy: number | null;
  /** Anteil der Fenster mit Messwert zwischen erstem und letztem Fenster. */
  coverage: number;
}

export interface Year {
  days: Day[];
  /** Höchste Leistung des Jahres in kW, Maßstab für alle Grate. */
  maxPower: number;
  /** Zeit des jüngsten gespeicherten Stands in ms, oder null. */
  lastReading: number | null;
}

/** Ein gespeicherter Stand der Tagesproduktion. */
export interface YieldPoint {
  t: number;
  value: number;
}

const zero = (v: number): Counters => ({ yield: v, exported: 0, imported: 0, charged: 0, discharged: 0 });

/**
 * Bereitet die Stände eines Tages nach den Regeln des Datenvertrags auf: Vortagsreste weg, und ein Rücksprung zählt nicht.
 * Der Vertrag verlangt, jeden Tageszähler als seinen bisher höchsten Wert zu lesen. Für die Leistung wird ein
 * zurückgesprungener Stand ganz übergangen statt gehalten; sonst entstünde über die 30 Minuten eine Delle.
 */
export function dayRows(points: YieldPoint[], key: string, yesterday: number | null): CounterRow[] {
  const rows: CounterRow[] = points.map((p) => ({ t: p.t, counters: zero(p.value) }));
  const start = viennaDayStart(key);
  let max = -Infinity;
  return validRows(rows, start, yesterday === null ? null : zero(yesterday)).filter((r) => {
    if (r.counters.yield < max) return false;
    max = r.counters.yield;
    return true;
  });
}

/** Halbe Breite des Fensters, über das die Leistung gemittelt wird. Die Cloud schreibt den Tageszähler nur etwa
 * alle 20 Minuten fort; über kürzere Abstände wechselten sich 0 und der doppelte Wert ab. */
const HALF_SPAN_MS = 15 * 60_000;

// Tageszähler zum Zeitpunkt t, linear zwischen den Ständen; null, wenn dort keine Stände nahe genug liegen.
function yieldAt(rows: CounterRow[], t: number): number | null {
  if (rows.length === 0 || t < rows[0].t || t > rows[rows.length - 1].t) return null;
  let lo = 0, hi = rows.length - 1;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (rows[mid].t <= t) lo = mid; else hi = mid; }
  const a = rows[lo], b = rows[hi];
  if (b.t - a.t > MAX_GAP_MS) return null;
  return b.t === a.t ? a.counters.yield : a.counters.yield + ((b.counters.yield - a.counters.yield) * (t - a.t)) / (b.t - a.t);
}

/** Leistung je Fenster aus den aufbereiteten Ständen eines Tages: Zuwachs über 30 Minuten um die Fenstermitte. */
export function dayPower(rows: CounterRow[], key: string): Float32Array {
  const power = new Float32Array(COLS).fill(NaN);
  const start = viennaDayStart(key).getTime();
  for (let c = 0; c < COLS; c++) {
    const t = start + (FIRST_MINUTE + c * WINDOW_MIN) * 60_000;
    const a = yieldAt(rows, t - HALF_SPAN_MS), b = yieldAt(rows, t + HALF_SPAN_MS);
    if (a !== null && b !== null) power[c] = Math.max(0, (b - a) / ((2 * HALF_SPAN_MS) / 3_600_000));
  }
  return power;
}

/**
 * Baut die Tage von `firstKey` bis `lastKey` (beide eingeschlossen). Tage ohne Stand bleiben Lücken.
 * Der Film beginnt mit dem ersten Tag, der eine Tageskurve hat: an ihm zeichnet die Sonne vor, was ein Berg ist.
 */
export function buildYear(points: YieldPoint[], firstKey: string, lastKey: string): Year {
  const byDay = new Map<string, YieldPoint[]>();
  for (const p of points) {
    const key = viennaDateKey(new Date(p.t));
    let list = byDay.get(key);
    if (!list) byDay.set(key, (list = []));
    list.push(p);
  }
  const days: Day[] = [];
  let yesterday: number | null = null;
  let lastReading: number | null = null;
  for (let key = firstKey; key <= lastKey; key = addDays(key, 1)) {
    const list = (byDay.get(key) ?? []).sort((a, b) => a.t - b.t);
    if (list.length === 0) {
      days.push({ key, power: new Float32Array(COLS).fill(NaN), energy: null, coverage: 0 });
      yesterday = null;
      continue;
    }
    const rows = dayRows(list, key, yesterday);
    lastReading = list[list.length - 1].t;
    const energy = rows.length > 0 ? rows[rows.length - 1].counters.yield : null;
    const power = dayPower(rows, key);
    let have = 0;
    for (const v of power) if (!Number.isNaN(v)) have++;
    days.push({ key, power, energy, coverage: have / COLS });
    yesterday = energy;
  }
  while (days.length > 0 && !((days[0].energy ?? 0) > 0.5 && days[0].coverage >= 0.5)) days.shift();
  return { days, maxPower: scaleOf(days), lastReading };
}

// Maßstab: sehr hohe Ausreißer (Nachholen nach einer Lücke) sollen nicht alle anderen Tage flach drücken.
function scaleOf(days: Day[]): number {
  const all: number[] = [];
  for (const d of days) for (const v of d.power) if (v > 0) all.push(v);
  if (all.length === 0) return 1;
  all.sort((a, b) => a - b);
  return Math.max(1, all[Math.min(all.length - 1, Math.floor(all.length * 0.998))]);
}

/** Höhe 0..1 eines Fensters; fehlende Fenster liegen im Nebel (0). */
export function level(year: Year, day: number, col: number): number {
  const d = year.days[day];
  if (!d) return 0;
  const v = d.power[col];
  return Number.isNaN(v) ? 0 : Math.min(1, v / year.maxPower);
}

/** Gitter für die Landschaft, leicht geglättet wie im Prototyp: Reihe = Tag (mit leeren Rändern), Spalte = Fenster. */
export function heightGrid(year: Year, pad: number): Float32Array {
  const rows = year.days.length + pad * 2;
  const out = new Float32Array(rows * COLS);
  const raw = (d: number, c: number) => level(year, d, Math.max(0, Math.min(COLS - 1, c)));
  const col = (d: number, c: number) => (raw(d, c - 1) + raw(d, c) * 2 + raw(d, c + 1)) / 4;
  for (let r = 0; r < rows; r++) {
    const d = r - pad;
    for (let c = 0; c < COLS; c++) out[r * COLS + c] = col(d, c) * 0.9 + (col(d - 1, c) + col(d + 1, c)) * 0.05;
  }
  return out;
}

/** Liest die Antwort der Jahresabfrage: nur `_time` und `_value`. */
export function parseYield(csv: string): YieldPoint[] {
  const out: YieldPoint[] = [];
  let timeCol = -1, valueCol = -1;
  for (const line of csv.split(/\r?\n/)) {
    if (line === '' || line.startsWith('#')) { timeCol = -1; continue; }
    const cells = line.split(',');
    if (timeCol < 0) { timeCol = cells.indexOf('_time'); valueCol = cells.indexOf('_value'); continue; }
    const t = Date.parse(cells[timeCol]);
    const value = Number(cells[valueCol]);
    if (Number.isFinite(t) && cells[valueCol] !== '' && Number.isFinite(value)) out.push({ t, value });
  }
  return out;
}
