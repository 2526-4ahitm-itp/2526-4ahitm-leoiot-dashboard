import { describe, expect, it } from 'vitest';
import { consumption, consumptionShares, productionShares, type Counters } from '@leoiot-pv/shared/energy';
import { MISSING, NBSP } from '../src/core/format';
import { donutModel } from '../src/panels/todayModel';

const c: Counters = { yield: 746.2, exported: 0, imported: 207, charged: 82.4, discharged: 141.2 };

describe('donutModel', () => {
  it('Verbrauch', () => {
    const m = donutModel(consumption(c), consumptionShares(c));
    expect(m.center).toBe('1012');
    expect(m.rows.map((r) => r.label)).toEqual(['Von PV', 'Vom Netz', 'Von Batterie']);
    expect(m.rows.map((r) => r.text)).toEqual([`664${NBSP}kWh`, `207${NBSP}kWh`, `141${NBSP}kWh`]);
    expect(m.rows.map((r) => r.source)).toEqual(['pv', 'netz', 'batterie']);
    expect(m.empty).toBe(false);
  });

  it('Produktion', () => {
    const m = donutModel(c.yield, productionShares(c));
    expect(m.center).toBe('746');
    expect(m.rows.map((r) => r.label)).toEqual(['Eigenverbrauch', 'In Batterie', 'Ins Netz']);
    expect(m.rows.map((r) => r.text)).toEqual([`664${NBSP}kWh`, `82,4${NBSP}kWh`, `0,0${NBSP}kWh`]);
  });

  it('ohne Daten', () => {
    const m = donutModel(null, []);
    expect(m.center).toBe(MISSING);
    expect(m.rows).toEqual([]);
    expect(m.empty).toBe(true);
  });

  it('alle Anteile 0', () => {
    const zero: Counters = { yield: 0, exported: 0, imported: 0, charged: 0, discharged: 0 };
    expect(donutModel(0, consumptionShares(zero)).empty).toBe(true);
    expect(donutModel(0, productionShares(zero)).empty).toBe(true);
  });

  it('Dezimalkomma statt Punkt', () => {
    const m = donutModel(c.yield, productionShares(c));
    for (const r of m.rows) expect(r.text).not.toContain('.');
    expect(m.center).not.toContain('.');
  });
});
