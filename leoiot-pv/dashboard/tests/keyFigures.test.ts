import { describe, it, expect } from 'vitest';
import type { PartialCounters } from '@leoiot-pv/shared/energy';
import { keyFigures } from '../src/core/keyFigures';
import { dayRows } from '../src/core/periods';
import { periodDays } from '../src/core/route';
import { pct, TEXT } from '../src/core/i18n';

const full = (prod: number, imp: number, cons: number): PartialCounters => ({
  yield: prod,
  exported: 0,
  charged: 0,
  imported: imp,
  discharged: cons - prod - imp, // Verbrauch = Produktion + Bezug + Entladung
});
const onlyYield = (prod: number): PartialCounters => ({ yield: prod });

describe('keyFigures', () => {
  it('August 2026 mit Daten vom 1. bis 9.: 29 % (9 von 31 Tagen), Werte nur aus diesen Tagen', () => {
    const days = periodDays('month', '2026-08-01');
    const byDay: Record<string, PartialCounters> = {};
    for (let d = 1; d <= 9; d++) byDay[`2026-08-${String(d).padStart(2, '0')}`] = full(100 + d * 10, d, 200 + d);
    const f = keyFigures(dayRows(days, byDay, '2026-10-07'));
    expect(f.completeness).toEqual({ percent: 29, complete: 9, past: 31, includesToday: false });
    expect(TEXT.de.completenessValue(pct(0.29, 'de'), 9, 31)).toBe('29 % (9 von 31 Tagen)');
    expect(f.bestProd).toEqual({ key: '2026-08-09', value: 190, today: false });
    expect(f.worstProd?.key).toBe('2026-08-01');
    expect(f.maxCons?.key).toBe('2026-08-09');
    expect(f.maxImp?.key).toBe('2026-08-09');
    expect(f.meanProd?.value).toBeCloseTo(150);
    expect(f.meanProd?.days).toBe(9);
  });

  it('laufende Woche an einem Mittwoch: Bestwerte und Mittel nur Montag und Dienstag, Vollständigkeit bis heute', () => {
    const days = periodDays('week', '2026-10-05'); // Mo 5.10. bis So 11.10.
    // heute (Mittwoch) erst 6,6 kWh: darf nicht der schwächste Tag sein und das Mittel nicht drücken
    const byDay = { '2026-10-05': full(50, 5, 80), '2026-10-06': full(60, 6, 90), '2026-10-07': full(6.6, 2, 40) };
    const f = keyFigures(dayRows(days, byDay, '2026-10-07'));
    expect(f.completeness).toEqual({ percent: 100, complete: 3, past: 3, includesToday: true });
    expect(f.worstProd).toEqual({ key: '2026-10-05', value: 50, today: false });
    expect(f.bestProd?.key).toBe('2026-10-06');
    expect(f.meanProd).toEqual({ value: 55, days: 2, includesToday: false });
  });

  it('Tage ohne Daten sind nie der schwächste Tag und senken den Mittelwert nicht', () => {
    const days = ['2026-09-14', '2026-09-15', '2026-09-16', '2026-09-17'];
    const byDay = { '2026-09-14': full(100, 1, 150), '2026-09-17': full(300, 3, 350) };
    const f = keyFigures(dayRows(days, byDay, '2026-10-07'));
    expect(f.worstProd?.key).toBe('2026-09-14');
    expect(f.meanProd).toEqual({ value: 200, days: 2, includesToday: false });
    expect(f.completeness).toEqual({ percent: 50, complete: 2, past: 4, includesToday: false });
  });

  it('vor dem 20. April: keine Verbrauchs- und Netzwerte, Produktion bleibt', () => {
    const days = ['2026-04-14', '2026-04-15'];
    const f = keyFigures(dayRows(days, { '2026-04-14': onlyYield(70), '2026-04-15': onlyYield(90) }, '2026-10-07'));
    expect(f.maxCons).toBeNull();
    expect(f.maxImp).toBeNull();
    expect(f.meanCons).toBeNull();
    expect(f.bestProd?.value).toBe(90);
    expect(f.completeness).toEqual({ percent: 0, complete: 0, past: 2, includesToday: false });
  });

  it('Zeitraum ganz in der Zukunft: keine Vollständigkeit', () => {
    const f = keyFigures(dayRows(['2026-11-01'], {}, '2026-10-07'));
    expect(f.completeness).toBeNull();
    expect(f.bestProd).toBeNull();
  });
});
