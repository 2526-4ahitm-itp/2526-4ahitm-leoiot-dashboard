import { describe, it, expect } from 'vitest';
import type { PowerPoint } from '@leoiot-pv/shared/influx';
import { SLOT_MS } from '@leoiot-pv/shared/time';
import { kw } from '../src/core/i18n';
import { dayPeaks, gridSeries, type GridPoint } from '../src/core/peaks';

const START = Date.UTC(2026, 9, 11, 22, 0, 0); // 12. Oktober 2026, 00:00 Wiener Zeit
const SLOTS = 288;
const slotOf = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number);
  return (h * 60 + m) / 5;
};

/** Reihe mit festem Grundwert und einzelnen Werten je Fenster. */
function series(base: number | null, set: Record<number, number | null> = {}): (number | null)[] {
  return Array.from({ length: SLOTS }, (_, i) => (i in set ? set[i] : base));
}
function build(prod: (number | null)[], load: (number | null)[], grid: (number | null)[] | null): { power: PowerPoint[]; grid: GridPoint[] } {
  const power = prod.map((p, i) => ({ t: START + i * SLOT_MS + 1000, production: p, consumption: load[i] }));
  const g = grid ? grid.map((v, i) => ({ t: START + i * SLOT_MS + 1000, grid: v })) : [];
  return { power, grid: g };
}
/** Plateau über drei Fenster, damit das 15-Minuten-Mittel den Wert erreicht. */
const plateau = (at: string, v: number): Record<number, number> => {
  const i = slotOf(at);
  return { [i - 1]: v, [i]: v, [i + 1]: v };
};

describe('dayPeaks', () => {
  it('vergangener Tag mit den Zahlen der Spec', () => {
    const { power, grid } = build(
      series(10, plateau('12:45', 61.8)),
      series(31.2),
      series(5, plateau('11:15', 104.3)),
    );
    const p = dayPeaks(power, grid, SLOTS, START, null);
    expect(p.prodPeak?.kw).toBeCloseTo(61.8);
    expect(p.prodPeak?.time).toBe('12:45');
    expect(p.gridPeak?.kw).toBeCloseTo(104.3);
    expect(p.gridPeak?.time).toBe('11:15');
    expect(p.baseLoad?.kw).toBeCloseTo(31.2);
    expect(p.baseLoad?.partial).toBe(false);
    expect(kw(p.gridPeak?.kw, 'de')).toBe('104 kW');
    expect(kw(p.prodPeak?.kw, 'de')).toBe('61,8 kW');
  });

  it('eine einzelne Spitze wird vom 15-Minuten-Mittel gedämpft', () => {
    const { power, grid } = build(series(10, { [slotOf('12:00')]: 100 }), series(20), series(0));
    const p = dayPeaks(power, grid, SLOTS, START, null);
    expect(p.prodPeak?.kw).toBeCloseTo(40); // (10 + 100 + 10) / 3
    expect(p.prodPeak?.time).toBe('11:55'); // erstes der drei gleich hohen Fenster
  });

  it('nur positiver Netzbezug zählt, Einspeisung nicht', () => {
    const { power, grid } = build(series(10), series(20), series(-50, plateau('09:00', 3)));
    const p = dayPeaks(power, grid, SLOTS, START, null);
    expect(p.gridPeak?.kw).toBeCloseTo(3);
    expect(p.gridPeak?.time).toBe('09:00');
  });

  it('heute um 03:00: Grundlast nur aus 00:00 bis 03:00 und als "bisher" gekennzeichnet', () => {
    // Fenster bis 03:00 (und das laufende) 20 kW; spätere Werte dürfen nicht eingehen
    const load = series(100, Object.fromEntries(Array.from({ length: 37 }, (_, i) => [i, 20])));
    const { power, grid } = build(series(0), load, series(0));
    const p = dayPeaks(power, grid, SLOTS, START, slotOf('03:00'));
    expect(p.baseLoad?.kw).toBeCloseTo(20, 0);
    expect(p.baseLoad?.partial).toBe(true);
  });

  it('heute nach 04:00 ist die Grundlast vollständig', () => {
    const { power, grid } = build(series(0), series(25), series(0));
    expect(dayPeaks(power, grid, SLOTS, START, slotOf('14:00')).baseLoad).toEqual({ kw: 25, partial: false });
  });

  it('Lücken zählen nie, fehlende Reihen ergeben null', () => {
    const { power, grid } = build(series(null), series(null), null);
    expect(dayPeaks(power, grid, SLOTS, START, null)).toEqual({ prodPeak: null, gridPeak: null, baseLoad: null });
  });

  it('Tag vor dem 20. April: nur Produktion', () => {
    const { power } = build(series(8, plateau('13:00', 30)), series(null), null);
    const p = dayPeaks(power, [], SLOTS, START, null);
    expect(p.prodPeak?.kw).toBeCloseTo(30);
    expect(p.gridPeak).toBeNull();
    expect(p.baseLoad).toBeNull();
  });

  it('Netzbezug 0 ergibt einen Wert ohne Uhrzeit', () => {
    const { power, grid } = build(series(1), series(1), series(-4));
    const p = dayPeaks(power, grid, SLOTS, START, null);
    expect(p.gridPeak).toEqual({ kw: 0, time: null });
  });
});

describe('gridSeries', () => {
  const row = (min: number, imported: number, exported: number): { t: number; counters: { yield: number; exported: number; imported: number; charged: number; discharged: number } } => ({
    t: START + min * 60_000,
    counters: { yield: 0, exported, imported, charged: 0, discharged: 0 },
  });
  it('Bezug positiv, Einspeisung negativ, Lücke über 15 Minuten ist null', () => {
    const out = gridSeries([row(5, 0, 0), row(10, 1, 0), row(15, 1, 0.5), row(40, 5, 0.5)], new Date(START));
    expect(out.map((p) => p.grid?.toFixed(1))).toEqual(['0.0', '12.0', '-6.0', undefined]);
  });
});
