import { describe, it, expect } from 'vitest';
import {
  completeCounters,
  consumption,
  consumptionShares,
  powerBetween,
  productionShares,
  selfConsumption,
  weekValues,
  type Counters,
} from '../src/energy';

const spec: Counters = { yield: 746.2, exported: 0, charged: 82.4, imported: 207, discharged: 141.2 };

describe('energy', () => {
  it('Zahlenbeispiel aus der Spec', () => {
    expect(selfConsumption(spec)).toBeCloseTo(663.8, 6);
    expect(consumption(spec)).toBeCloseTo(1012.0, 6);
  });

  it('consumptionShares Reihenfolge und Werte', () => {
    const s = consumptionShares(spec);
    expect(s.map((x) => x.label)).toEqual(['Von PV', 'Vom Netz', 'Von Batterie']);
    expect(s[0].value).toBeCloseTo(663.8, 6);
    expect(s[1].value).toBeCloseTo(207, 6);
    expect(s[2].value).toBeCloseTo(141.2, 6);
    expect(s.map((x) => x.source)).toEqual(['pv', 'netz', 'batterie']);
  });

  it('productionShares Reihenfolge und Werte', () => {
    const s = productionShares(spec);
    expect(s.map((x) => x.label)).toEqual(['Eigenverbrauch', 'In Batterie', 'Ins Netz']);
    expect(s[0].value).toBeCloseTo(663.8, 6);
    expect(s[1].value).toBeCloseTo(82.4, 6);
    expect(s[2].value).toBeCloseTo(0, 6);
  });

  it('Eigenverbrauch nie negativ', () => {
    const c: Counters = { yield: 10, exported: 8, charged: 5, imported: 3, discharged: 1 };
    expect(selfConsumption(c)).toBe(0);
    expect(consumption(c)).toBeCloseTo(4, 6);
    for (const s of productionShares(c)) expect(s.value).toBeGreaterThanOrEqual(0);
  });

  it('Sortierung bei anderer Verteilung', () => {
    const c: Counters = { yield: 100, exported: 60, charged: 10, imported: 500, discharged: 0 };
    expect(consumptionShares(c).map((x) => x.label)).toEqual(['Vom Netz', 'Von PV', 'Von Batterie']);
    expect(productionShares(c).map((x) => x.label)).toEqual(['Ins Netz', 'Eigenverbrauch', 'In Batterie']);
  });

  it('Gleichstand behält die Reihenfolge', () => {
    const c: Counters = { yield: 0, exported: 0, charged: 0, imported: 0, discharged: 0 };
    expect(consumptionShares(c).map((x) => x.label)).toEqual(['Von PV', 'Vom Netz', 'Von Batterie']);
  });

  it('completeCounters', () => {
    expect(completeCounters({ ...spec })).toEqual(spec);
    expect(completeCounters({ yield: 1, exported: 1, imported: 1, charged: 1 })).toBeNull();
    expect(completeCounters({ ...spec, yield: NaN })).toBeNull();
    expect(completeCounters(null)).toBeNull();
    expect(completeCounters(undefined)).toBeNull();
  });

  it('weekValues', () => {
    const keys = ['2026-10-05', '2026-10-06', '2026-10-07'];
    const r = weekValues(keys, { '2026-10-05': { yield: 300 }, '2026-10-07': { ...spec } });
    expect(r.map((x) => x.key)).toEqual(keys);
    expect(r[0]).toEqual({ key: keys[0], production: 300, consumption: null, exported: null });
    expect(r[1]).toEqual({ key: keys[1], production: null, consumption: null, exported: null });
    expect(r[2].production).toBeCloseTo(746.2, 6);
    expect(r[2].consumption).toBeCloseTo(1012, 6);
    expect(r[2].exported).toBe(0);
  });

  const prev: Counters = { yield: 100, exported: 10, imported: 50, charged: 20, discharged: 5 };
  const next: Counters = { yield: 102, exported: 10.5, imported: 50, charged: 21, discharged: 5 };

  it('powerBetween normal', () => {
    const p = powerBetween(prev, next, 1 / 6)!;
    expect(p.pv).toBeCloseTo(12, 6);
    expect(p.grid).toBeCloseTo(-3, 6);
    expect(p.battery).toBeCloseTo(-6, 6);
    expect(p.load).toBeCloseTo(3, 6);
  });

  it('powerBetween mit entladender Batterie', () => {
    const zero: Counters = { yield: 0, exported: 0, imported: 0, charged: 0, discharged: 0 };
    const p = powerBetween(zero, { yield: 0, exported: 0, imported: 1, charged: 0, discharged: 0.5 }, 0.5)!;
    expect(p.pv).toBeCloseTo(0, 6);
    expect(p.grid).toBeCloseTo(2, 6);
    expect(p.battery).toBeCloseTo(1, 6);
    expect(p.load).toBeCloseTo(3, 6);
  });

  it('powerBetween bei Reset und hours 0', () => {
    expect(powerBetween({ ...prev, yield: 700 }, { ...next, yield: 0.1 }, 1 / 6)).toBeNull();
    expect(powerBetween(prev, next, 0)).toBeNull();
  });

  it('powerBetween mit winziger negativer Differenz', () => {
    const p = powerBetween(prev, { ...next, imported: 49.99 }, 1 / 6);
    expect(p).not.toBeNull();
    expect(p!.grid).toBeCloseTo(-3, 6);
  });
});
