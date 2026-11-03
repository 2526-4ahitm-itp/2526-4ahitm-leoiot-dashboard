import { describe, expect, it } from 'vitest';
import { buildYear } from '../src/core/yearData';
import { bestDay, co2Tonnes, counterAt, cumulative, milestones } from '../src/core/facts';
import { syntheticPoints } from './helpers';

const year = (missing: number[] = []) => buildYear(syntheticPoints('2026-06-01', 30, (i) => (i === 11 ? 20 : 10), missing), '2026-06-01', '2026-06-30');

describe('Zahlen des Films', () => {
  it('findet den besten Tag', () => {
    expect(bestDay(year())).toBe(11);
  });

  it('Zähler am Ende des Zeitraffers: der jüngste Gesamtertrag', () => {
    const y = year(); const cum = cumulative(y);
    expect(counterAt(y, cum, 250_000, y.days.length)).toBeCloseTo(250_000, 6);
  });

  it('Zähler während des Jahres: Gesamtertrag minus alles, was danach kam', () => {
    const y = year(); const cum = cumulative(y);
    const after = y.days.slice(10).reduce((a, d) => a + (d.energy ?? 0), 0);
    expect(counterAt(y, cum, 250_000, 10)).toBeCloseTo(250_000 - after, 6);
  });

  it('Zähler steht still, solange eine Lücke durchlaufen wird', () => {
    const y = year([5, 6]); const cum = cumulative(y);
    expect(counterAt(y, cum, 250_000, 5.2)).toBeCloseTo(counterAt(y, cum, 250_000, 6.8), 6);
  });

  it('Meilensteine bei jedem Vielfachen von 10 000 kWh', () => {
    const y = year(); const cum = cumulative(y);
    const start = counterAt(y, cum, 160_100, 0);
    const ms = milestones(y, cum, 160_100);
    const expected: number[] = [];
    for (let k = Math.ceil(start / 10_000) * 10_000; k < 160_100; k += 10_000) expected.push(k);
    expect(ms.map((m) => m.kwh)).toEqual(expected);
    expect(expected.length).toBeGreaterThan(0);
    for (const m of ms) expect(counterAt(y, cum, 160_100, m.day + 1)).toBeGreaterThanOrEqual(m.kwh);
  });

  it('CO₂ für 186 420 kWh: 31,5 t', () => {
    expect(co2Tonnes(186_420).toFixed(1)).toBe('31.5');
  });
});
