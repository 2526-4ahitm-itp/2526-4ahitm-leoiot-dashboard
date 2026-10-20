import { describe, it, expect } from 'vitest';
import { dayRanges, daysPlain, gapSentence, missingSummary } from '../src/core/gaps';
import { dayRows, totals } from '../src/core/periods';
import { periodDays } from '../src/core/route';

const full = { yield: 1, exported: 0, charged: 0, imported: 1, discharged: 0 };
const rowsFor = (view: 'week' | 'month' | 'year', key: string, have: (k: string) => boolean | 'prod', today = '2026-10-07') => {
  const days = periodDays(view, key);
  const by: Record<string, object> = {};
  for (const d of days) {
    const h = have(d);
    if (h === true) by[d] = full;
    else if (h === 'prod') by[d] = { yield: 1 };
  }
  return dayRows(days, by, today);
};

describe('Lücken als Bereiche', () => {
  it('dayRanges fasst aufeinanderfolgende Tage zusammen', () => {
    expect(dayRanges(['2026-08-30', '2026-08-31', '2026-09-01', '2026-09-16'])).toEqual([['2026-08-30', '2026-09-01'], ['2026-09-16', '2026-09-16']]);
  });
  it('ein Bereich, DE und EN', () => {
    const rows = rowsFor('month', '2026-08-01', (k) => k < '2026-08-10');
    expect(gapSentence(rows, 'month', 'de')).toBe('Keine Daten vom 10. bis 31. August');
    expect(gapSentence(rows, 'month', 'en')).toBe('No data from 10 to 31 August');
  });
  it('ein einzelner Tag', () => {
    const rows = rowsFor('month', '2026-09-01', (k) => k !== '2026-09-16');
    expect(gapSentence(rows, 'month', 'de')).toBe('Keine Daten am 16. September');
    expect(gapSentence(rows, 'month', 'en')).toBe('No data on 16 September');
  });
  it('mehrere Bereiche mit und', () => {
    const rows = rowsFor('month', '2026-08-01', (k) => k !== '2026-08-03' && !(k >= '2026-08-10' && k <= '2026-08-12') && k !== '2026-08-20');
    expect(gapSentence(rows, 'month', 'de')).toBe('Keine Daten am 3. August, vom 10. bis 12. August und am 20. August');
    expect(gapSentence(rows, 'month', 'en')).toBe('No data on 3 August, from 10 to 12 August and on 20 August');
  });
  it('keine Lücke: leer; künftige Tage zählen nicht', () => {
    expect(gapSentence(rowsFor('month', '2026-10-01', (k) => k <= '2026-10-07'), 'month', 'de')).toBe('');
  });
  it('Jahr: ganze Monate als Bereich, sonst Tageszahl', () => {
    const rows = rowsFor('year', '2026-01-01', (k) => k >= '2026-04-01' && k !== '2026-06-05' && k !== '2026-06-06');
    expect(gapSentence(rows, 'year', 'de')).toBe('Keine Daten von Jänner bis März und an 2 weiteren Tagen');
    expect(gapSentence(rows, 'year', 'en')).toBe('No data from January to March and on 2 more days');
  });
});

describe('missingSummary', () => {
  it('alle Größen mit gleicher Anzahl: eine Zeile, keine Einzelhinweise', () => {
    const rows = rowsFor('month', '2026-08-01', (k) => k < '2026-08-10');
    const s = missingSummary(rows, totals(rows).sum);
    expect(s.common?.n).toBe(22);
    expect(s.extra).toEqual({});
    expect(daysPlain(rows, s.common!.days, 'month', 'de')).toBe('10. bis 31. August');
  });
  it('Abweichung nur bei der Größe mit mehr fehlenden Tagen', () => {
    // 1. bis 19. April nur Produktion, danach alles
    const rows = rowsFor('month', '2026-04-01', (k) => (k < '2026-04-20' ? 'prod' : true));
    const s = missingSummary(rows, totals(rows).sum);
    expect(s.common?.n).toBe(19); // Produktion vollständig, alle anderen gleich: eine Zeile
    expect(s.extra).toEqual({});
    expect(daysPlain(rows, s.common!.days, 'month', 'en')).toBe('1 to 19 April');
  });
  it('Lückentage plus Tage vor dem Start der Netzdaten', () => {
    const rows = rowsFor('month', '2026-04-01', (k) => (k === '2026-04-05' ? false : k < '2026-04-20' ? 'prod' : true));
    const s = missingSummary(rows, totals(rows).sum);
    // sechs Größen fehlen an 19 Tagen, nur die Produktion an einem: die 19 steht oben
    expect(s.common?.n).toBe(19);
    expect(s.extra).toEqual({ prod: 1 });
  });
});
