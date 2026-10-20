// Leistungsfeld: Zahlen für das Diagramm, rein und ohne DOM.
import type { PowerPoint } from '@leoiot-pv/shared/influx';
import { formatTick } from '@leoiot-pv/shared/format';
import { viennaTime } from '@leoiot-pv/shared/time';

export const HOUR_MS = 3_600_000;

export interface XY {
  x: number;
  y: number | null;
}

export interface PowerModel {
  production: XY[]; // y >= 0
  consumption: XY[]; // y <= 0 (nur zum Zeichnen gespiegelt; Beschriftungen zeigen Beträge)
  max: number; // Achse reicht von -max bis +max
  step: number; // Abstand der Achsenstriche
  ticks: number[]; // Zeitachse: Zeitpunkte in ms
}

const STEPS = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000];

/** Achsenmaximum und Schrittweite: höchstens drei Schritte je Richtung. */
export function powerScale(points: PowerPoint[]): { max: number; step: number } {
  let peak = 0;
  for (const p of points) {
    for (const v of [p.production, p.consumption]) {
      if (v !== null && Number.isFinite(v)) peak = Math.max(peak, Math.abs(v));
    }
  }
  let step = 5;
  if (peak > 0) {
    const found = STEPS.find((s) => s * 3 >= peak * 1.05);
    step = found ?? Math.ceil((peak * 1.05) / 3);
  }
  return { max: step * 3, step };
}

/** Zeitachse: alle drei Stunden ab Tagesbeginn, der letzte Strich ist das Tagesende. */
export function timeTicks(dayStart: number, dayEnd: number): number[] {
  const ticks: number[] = [];
  for (let t = dayStart; t < dayEnd - 1.5 * HOUR_MS; t += 3 * HOUR_MS) ticks.push(t);
  ticks.push(dayEnd);
  return ticks;
}

/** Beschriftung der Zeitachse; das Tagesende heißt '24:00'. */
export function timeLabel(t: number, dayEnd: number): string {
  return t >= dayEnd ? '24:00' : viennaTime(new Date(t));
}

/** Beschriftung der Leistungsachse: Betrag, nie ein Minuszeichen. */
export function powerTick(v: number | string): string {
  return formatTick(Math.abs(Number(v)));
}

export function powerModel(points: PowerPoint[], dayStart: number, dayEnd: number): PowerModel {
  const shown = points.filter((p) => p.t <= dayEnd);
  const { max, step } = powerScale(shown);
  return {
    production: shown.map((p) => ({ x: p.t, y: p.production })),
    // + 0 macht aus -0 eine 0
    consumption: shown.map((p) => ({ x: p.t, y: p.consumption === null ? null : -Math.abs(p.consumption) + 0 })),
    max,
    step,
    ticks: timeTicks(dayStart, dayEnd),
  };
}
