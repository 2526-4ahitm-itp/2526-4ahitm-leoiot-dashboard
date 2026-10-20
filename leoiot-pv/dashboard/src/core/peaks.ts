// Spitzen des Tages: höchste Produktion, höchster Netzbezug, Grundlast (Design D11, reine Funktionen).
import { powerBetween, type Counters } from '@leoiot-pv/shared/energy';
import { monotoneRows, type CounterRow, type PowerPoint } from '@leoiot-pv/shared/influx';
import { SLOT_MS, viennaTime } from '@leoiot-pv/shared/time';
import { smoothPower } from './chartData';

const MINUTE_MS = 60_000;
const HOUR_MS = 3_600_000;
/** Grundlast: 00:00 bis 04:00 sind 48 Fenster zu 5 Minuten. */
export const BASE_LOAD_SLOTS = 48;

/** Netzleistung in kW (positiv = Bezug) zu einem Zeitpunkt; null = Lücke. */
export interface GridPoint {
  t: number;
  grid: number | null;
}

/** Netzleistung aus den Zählerständen, mit denselben Regeln wie powerSeries (die Kurve der Gesamtleistung enthält sie nicht). */
export function gridSeries(rawRows: CounterRow[], dayStart: Date): GridPoint[] {
  if (rawRows.length === 0) return [];
  const rows = monotoneRows(rawRows);
  const zero: Counters = { yield: 0, exported: 0, imported: 0, charged: 0, discharged: 0 };
  const stands: CounterRow[] =
    rows[0].t - dayStart.getTime() <= 15 * MINUTE_MS ? [{ t: dayStart.getTime(), counters: zero }, ...rows] : rows;
  const out: GridPoint[] = [];
  for (let i = 1; i < stands.length; i++) {
    const dt = stands[i].t - stands[i - 1].t;
    const p = dt > 15 * MINUTE_MS || dt <= 0 ? null : powerBetween(stands[i - 1].counters, stands[i].counters, dt / HOUR_MS);
    out.push({ t: stands[i].t, grid: p === null ? null : p.grid });
  }
  return out;
}

export interface Peak {
  kw: number;
  /** Uhrzeit des Fensters in Wiener Zeit; null, wenn der Wert 0 ist (kein Zeitpunkt). */
  time: string | null;
}

export interface DayPeaks {
  prodPeak: Peak | null;
  gridPeak: Peak | null;
  baseLoad: { kw: number; partial: boolean } | null;
}

function bin(points: { t: number; v: number | null }[], slots: number, startMs: number, lastSlot: number | null): (number | null)[] {
  const out: (number | null)[] = new Array(slots).fill(null);
  for (const p of points) {
    const i = Math.floor((p.t - startMs) / SLOT_MS);
    if (i < 0 || i >= slots || (lastSlot !== null && i > lastSlot)) continue;
    out[i] = p.v;
  }
  return out;
}

function highest(data: (number | null)[], startMs: number): Peak | null {
  let at = -1;
  for (let i = 0; i < data.length; i++) {
    const v = data[i];
    if (v !== null && (at < 0 || v > (data[at] as number))) at = i;
  }
  if (at < 0) return null;
  const kw = data[at] as number;
  return { kw, time: kw > 0 ? viennaTime(new Date(startMs + at * SLOT_MS)) : null };
}

/**
 * Spitzen aus dem gleitenden 15-Minuten-Mittel der Leistungskurve (wie im Diagramm).
 * nowSlot: Fenster, in dem "jetzt" liegt (nur für heute), sonst null. Lücken zählen nie.
 */
export function dayPeaks(power: PowerPoint[], grid: GridPoint[], slots: number, startMs: number, nowSlot: number | null): DayPeaks {
  const prod = smoothPower(bin(power.map((p) => ({ t: p.t, v: p.production })), slots, startMs, nowSlot));
  const load = smoothPower(bin(power.map((p) => ({ t: p.t, v: p.consumption })), slots, startMs, nowSlot));
  const draw = smoothPower(bin(grid.map((p) => ({ t: p.t, v: p.grid === null ? null : Math.max(0, p.grid) })), slots, startMs, nowSlot));

  // Grundlast: bei heute nur die abgeschlossenen Fenster seit Mitternacht
  const upTo = Math.min(BASE_LOAD_SLOTS, slots, nowSlot === null ? slots : Math.max(0, nowSlot));
  const used = load.slice(0, upTo).filter((v): v is number => v !== null);
  const partial = nowSlot !== null && nowSlot < BASE_LOAD_SLOTS;
  return {
    prodPeak: highest(prod, startMs),
    gridPeak: highest(draw, startMs),
    baseLoad: used.length === 0 ? null : { kw: used.reduce((a, b) => a + b, 0) / used.length, partial },
  };
}
