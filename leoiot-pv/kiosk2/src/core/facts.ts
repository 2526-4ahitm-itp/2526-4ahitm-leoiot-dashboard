// Zahlen, die der Film nennt: bester Tag, Meilensteine, Zähler, CO₂ (reine Funktionen).
import type { Year } from './yearData';

/** Umweltbundesamt REP-0948 (Wien 2025), Tabelle 4: Stromaufbringung Österreich 209 minus Photovoltaik-Vorkette 40 g CO₂-eq/kWh. */
export const CO2_G_PER_KWH = 169;
export const CO2_SOURCE = 'Faktor 169 g/kWh, nach Umweltbundesamt REP-0948';
export const MILESTONE_KWH = 10_000;

/** Index des Tages mit der höchsten Produktion, oder -1 ohne Daten. */
export function bestDay(year: Year): number {
  let best = -1;
  year.days.forEach((d, i) => {
    if (d.energy !== null && (best < 0 || d.energy > (year.days[best].energy ?? 0))) best = i;
  });
  return best;
}

/** Produktion bis einschließlich Tag i; fehlende Tage zählen 0. */
export function cumulative(year: Year): Float64Array {
  const out = new Float64Array(year.days.length + 1);
  year.days.forEach((d, i) => { out[i + 1] = out[i] + (d.energy ?? 0); });
  return out;
}

/**
 * Zähler „kWh erzeugt“ an der Stelle `day` (12,5 = Mittag von Tag 12): der jüngste Gesamtertrag minus alles,
 * was danach noch produziert wurde. Am heutigen Ende stimmt er genau; Lücken lassen ihn stillstehen.
 * `todayShare` ist der Anteil der heutigen Produktion, der zum Zeitpunkt des jüngsten Gesamtertrags schon da war (1).
 */
export function counterAt(year: Year, cum: Float64Array, total: number, day: number): number {
  const n = year.days.length;
  if (n === 0) return total;
  const d = Math.max(0, Math.min(n - 1, Math.floor(day)));
  const frac = Math.max(0, Math.min(1, day - d));
  const after = cum[n] - cum[d + 1] + (year.days[d].energy ?? 0) * (1 - frac);
  return total - after;
}

export interface Milestone {
  day: number; // Tag, an dem der Stand erreicht wird
  kwh: number;
}

/** Jedes Vielfache von 10 000 kWh, das im gezeigten Zeitraum erreicht wird. */
export function milestones(year: Year, cum: Float64Array, total: number): Milestone[] {
  const out: Milestone[] = [];
  const startTotal = counterAt(year, cum, total, 0);
  for (let k = Math.ceil(startTotal / MILESTONE_KWH) * MILESTONE_KWH; k < total; k += MILESTONE_KWH) {
    for (let d = 0; d < year.days.length; d++) {
      if (counterAt(year, cum, total, d + 1) >= k) { out.push({ day: d, kwh: k }); break; }
    }
  }
  return out;
}

/** Vermiedenes CO₂ in Tonnen. */
export function co2Tonnes(totalKwh: number): number {
  return (totalKwh * CO2_G_PER_KWH) / 1_000_000;
}
