import { readFileSync } from 'node:fs';
import { addDays } from '@leoiot-pv/shared/time';
import { buildYear, heightGrid, parseYield, COLS, type Year, type YieldPoint } from '../src/core/yearData';
import { bestDay, cumulative, milestones } from '../src/core/facts';
import { schedule, type FilmInput } from '../src/core/film';
import { PAD } from '../src/core/world';

/** Ein echtes Jahr (14.04. bis 03.11.2026) aus der Datenbank, nur Zeit und Wert. */
export const fixturePoints = (): YieldPoint[] => parseYield(readFileSync(new URL('./fixtures/year.csv', import.meta.url), 'utf8'));
export const fixtureYear = (): Year => buildYear(fixturePoints(), '2025-11-04', '2026-11-03');

export const MONTHS = ['Jänner', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];

/** Eingabe für den Ablauf, wie die Anwendung sie baut. */
export function inputOf(year: Year, total = 250_000, now = 0.5): FilmInput {
  const grid = heightGrid(year, PAD);
  const cum = cumulative(year);
  return {
    days: year.days.length,
    levels: (d, c) => grid[(Math.max(-PAD, Math.min(year.days.length + PAD - 1, d)) + PAD) * COLS + c] ?? 0,
    energy: (d) => year.days[d]?.energy ?? null,
    coverage: (d) => year.days[d]?.coverage ?? 0,
    best: bestDay(year),
    milestones: milestones(year, cum, total),
    monthStarts: year.days.flatMap((d, i) => (i === 0 || d.key.endsWith('-01') ? [{ day: i, label: MONTHS[Number(d.key.slice(5, 7)) - 1] }] : [])),
    now,
  };
}

export const fixtureSchedule = (now = 0.5) => schedule(inputOf(fixtureYear(), 250_000, now));

/** Ein künstliches Jahr: n Tage ab firstKey, jeder mit einer glatten Tageskurve der Höhe peak(i) kWh/10 min. */
export function syntheticPoints(firstKey: string, n: number, peak: (i: number) => number, missing: number[] = []): YieldPoint[] {
  const pts: YieldPoint[] = [];
  for (let i = 0; i < n; i++) {
    if (missing.includes(i)) continue;
    const key = addDays(firstKey, i);
    const start = Date.parse(key + 'T00:00:00+02:00');
    let y = 0;
    for (let m = 0; m < 1440; m += 10) {
      const x = (m - 750) / 330;
      if (Math.abs(x) < 1) y += peak(i) * Math.cos((x * Math.PI) / 2) ** 2;
      pts.push({ t: start + m * 60_000, value: Math.round(y * 10) / 10 });
    }
  }
  return pts;
}
