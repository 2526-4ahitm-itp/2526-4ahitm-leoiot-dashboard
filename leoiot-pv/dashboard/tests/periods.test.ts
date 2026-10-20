import { describe, it, expect } from 'vitest';
import type { PartialCounters } from '@leoiot-pv/shared/energy';
import { dayRows, monthRows, quantities, ratios, totals } from '../src/core/periods';
import { periodDays } from '../src/core/route';
import { pct } from '../src/core/i18n';

// Zähler aus Produktion, Ins Netz, In Batterie, Vom Netz, Von Batterie
const c = (prod: number, exp: number, chg: number, imp: number, dis: number): PartialCounters => ({
  yield: prod,
  exported: exp,
  charged: chg,
  imported: imp,
  discharged: dis,
});
const onlyYield = (prod: number): PartialCounters => ({ yield: prod });

describe('quantities', () => {
  it('Sommertag 410/52/60/18/40', () => {
    const q = quantities(c(410, 52, 60, 18, 40));
    expect(q.self).toBeCloseTo(298);
    expect(q.cons).toBeCloseTo(356);
    const r = ratios(q);
    expect(r.autarky).toBeCloseTo(0.9494, 3);
    expect(r.selfRate).toBeCloseTo(0.8732, 3);
    expect(pct(r.autarky, 'de')).toBe('95\u00a0%');
    expect(pct(r.selfRate, 'de')).toBe('87\u00a0%');
  });
  it('nur Produktion: Rest unbekannt, nie 0', () => {
    const q = quantities(onlyYield(120));
    expect(q).toEqual({ prod: 120, exp: null, chg: null, imp: null, dis: null, self: null, cons: null });
  });
  it('kein Eintrag: alles unbekannt', () => {
    expect(Object.values(quantities(null)).every((v) => v === null)).toBe(true);
  });
});

describe('dayRows', () => {
  it('Lücke, heute, Zukunft, abgeschlossen', () => {
    const rows = dayRows(['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22'], { '2026-10-19': onlyYield(5) }, '2026-10-21');
    expect(rows.map((r) => [r.finished, r.gap, r.today, r.future])).toEqual([
      [true, false, false, false],
      [true, true, false, false],
      [false, true, true, false],
      [false, false, false, true],
    ]);
  });
});

describe('totals', () => {
  const today = '2026-10-25';
  it('Woche: 300, 280, 0, 310, 295, 120, 90 ergibt 1395', () => {
    const days = periodDays('week', '2026-10-05');
    const by: Record<string, PartialCounters> = {};
    [300, 280, 0, 310, 295, 120, 90].forEach((v, i) => (by[days[i]] = c(v, 0, 0, 0, 0)));
    const t = totals(dayRows(days, by, today));
    expect(t.sum.prod).toBe(1395);
    expect(t.missing.prod).toBe(0);
  });
  it('April 2026: Tage 1 bis 19 nur Produktion', () => {
    const days = periodDays('month', '2026-04-01');
    const by: Record<string, PartialCounters> = {};
    days.forEach((k, i) => (by[k] = i < 19 ? onlyYield(100) : c(100, 20, 10, 30, 5)));
    const t = totals(dayRows(days, by, '2026-10-21'));
    expect(t.missing.prod).toBe(0);
    for (const f of ['exp', 'chg', 'imp', 'dis', 'self', 'cons'] as const) expect(t.missing[f]).toBe(19);
    expect(t.ratioFrom).toBe('2026-04-20');
    expect(t.ratioTo).toBe('2026-04-30');
    expect(t.ratioDays).toBe(11);
    expect(t.sum.prod).toBe(3000);
    expect(t.sum.exp).toBe(220);
  });
  it('Lückentag in der Woche zählt als fehlend für jede Größe', () => {
    const days = periodDays('week', '2026-10-05');
    const by: Record<string, PartialCounters> = {};
    days.forEach((k, i) => {
      if (i !== 3) by[k] = c(100, 10, 10, 10, 10);
    });
    const t = totals(dayRows(days, by, today));
    expect(t.missing.prod).toBe(1);
    expect(t.missing.cons).toBe(1);
    expect(t.sum.prod).toBe(600);
    expect(t.ratioDays).toBe(6);
  });
  it('Produktion 0: Eigenverbrauchsquote null', () => {
    const t = totals(dayRows(['2026-10-10'], { '2026-10-10': c(0, 0, 0, 5, 0) }, today));
    expect(t.ratios.selfRate).toBeNull();
    expect(t.ratios.autarky).toBeCloseTo(0);
  });
  it('keine Werte: Summe null, keine Kennzahlen', () => {
    const t = totals(dayRows(['2026-10-10'], {}, today));
    expect(t.sum.prod).toBeNull();
    expect(t.ratios).toEqual({ autarky: null, selfRate: null });
    expect(t.ratioFrom).toBeNull();
  });
  it('aktuelle Woche am Mittwoch 21.10.2026: Do bis So sind Zukunft und nicht fehlend', () => {
    const days = periodDays('week', '2026-10-21');
    const by: Record<string, PartialCounters> = {};
    days.slice(0, 3).forEach((k) => (by[k] = c(100, 10, 10, 10, 10)));
    const t = totals(dayRows(days, by, '2026-10-21'));
    expect(t.pastDays).toBe(3);
    expect(t.missing.prod).toBe(0);
    expect(t.missing.cons).toBe(0);
  });
});

describe('monthRows', () => {
  it('zwölf Monate mit Zukunft und aktuellem Monat', () => {
    const days = periodDays('year', '2026-01-01');
    const by: Record<string, PartialCounters> = {};
    days.forEach((k) => (by[k] = c(10, 1, 1, 1, 1)));
    const rows = monthRows(2026, dayRows(days, by, '2026-10-21'), '2026-10-21');
    expect(rows).toHaveLength(12);
    expect(rows[0].totals.sum.prod).toBe(310);
    expect(rows[9].current).toBe(true);
    expect(rows[9].future).toBe(false);
    expect(rows[10].future).toBe(true);
    expect(rows[10].totals.pastDays).toBe(0);
    expect(rows[9].totals.pastDays).toBe(21);
    expect(rows[1].firstKey).toBe('2026-02-01');
  });
});
