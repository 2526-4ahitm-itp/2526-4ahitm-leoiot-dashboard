import { describe, it, expect } from 'vitest';
import type { PartialCounters } from '@leoiot-pv/shared/energy';
import { isoWeek, leadParagraphs, liveParts, periodTitle, rangeText, type LeadInput, type Part } from '../src/core/lead';
import { dayRows, totals } from '../src/core/periods';
import { periodDays, type View } from '../src/core/route';

const NB = ' ';
const c = (prod: number, exp: number, chg: number, imp: number, dis: number): PartialCounters => ({
  yield: prod,
  exported: exp,
  charged: chg,
  imported: imp,
  discharged: dis,
});
const text = (paras: Part[][]): string[] =>
  paras.map((p) => p.map((x) => ('text' in x ? x.text : x.chip.value)).join(''));
const chips = (paras: Part[][]) => paras.flat().flatMap((x) => ('chip' in x ? [x.chip.quantity] : []));

function input(view: View, key: string, byDay: Record<string, PartialCounters>, today: string, lang: 'de' | 'en' = 'de'): LeadInput {
  const rows = dayRows(periodDays(view, key), byDay, today);
  return { view, key, rows, totals: totals(rows), lang, nowTime: '14:02', todayKey: today };
}

describe('Leitsatz Tag', () => {
  const summer = { '2026-10-14': c(410, 52, 60, 18, 40) };
  it('Sommertag: Produktion, Verbrauch, Autarkie', () => {
    const p = leadParagraphs(input('day', '2026-10-14', summer, '2026-10-20'));
    expect(text(p)).toEqual([
      `Am Mittwoch, 14. Oktober 2026 hat die Anlage 410${NB}kWh produziert.`,
      `Die Schule hat 356${NB}kWh verbraucht, 95${NB}% davon kamen nicht aus dem Netz.`,
    ]);
    expect(chips(p)).toEqual(['prod', 'cons', 'autarky']);
  });
  it('Englisch', () => {
    const p = leadParagraphs(input('day', '2026-10-14', summer, '2026-10-20', 'en'));
    expect(text(p)).toEqual([
      `On Wednesday, 14 October 2026, the system produced 410${NB}kWh.`,
      `The school consumed 356${NB}kWh, 95${NB}% of it did not come from the grid.`,
    ]);
  });
  it('heute: "Heute bis HH:MM"', () => {
    const p = leadParagraphs(input('day', '2026-10-07', { '2026-10-07': c(60, 5, 10, 3, 4) }, '2026-10-07'));
    expect(text(p)[0]).toBe(`Heute bis 14:02 hat die Anlage 60,0${NB}kWh produziert.`);
    expect(text(leadParagraphs(input('day', '2026-10-07', { '2026-10-07': c(60, 5, 10, 3, 4) }, '2026-10-07', 'en')))[0]).toBe(
      `Today until 14:02, the system has produced 60.0${NB}kWh.`,
    );
  });
  it('Tag vor dem 20. April: nur Produktion, Rest in Worten, nie 0', () => {
    const p = text(leadParagraphs(input('day', '2026-04-10', { '2026-04-10': { yield: 120 } }, '2026-10-20')));
    expect(p[0]).toContain(`120${NB}kWh produziert`);
    expect(p[1]).toBe('Netz, Batterie und Verbrauch wurden an diesem Tag noch nicht erfasst.');
  });
  it('Tag ohne Werte: Lücke', () => {
    expect(text(leadParagraphs(input('day', '2026-09-16', {}, '2026-10-20')))).toEqual([
      'Am Mittwoch, 16. September 2026 wurden keine Werte gespeichert.',
    ]);
    expect(text(leadParagraphs(input('day', '2026-09-16', {}, '2026-10-20', 'en')))[0]).toBe(
      'No readings were stored on Wednesday, 16 September 2026.',
    );
  });
  it('Produktion 0: nichts produziert', () => {
    expect(text(leadParagraphs(input('day', '2026-12-01', { '2026-12-01': c(0, 0, 0, 5, 0) }, '2027-01-01')))[0]).toBe(
      'Am Dienstag, 1. Dezember 2026 wurde nichts produziert.',
    );
  });
});

describe('Leitsatz Zeiträume', () => {
  const full = (_k?: string): PartialCounters => c(100, 10, 10, 20, 10);
  it('Woche vollständig', () => {
    const days = periodDays('week', '2026-09-28');
    const by = Object.fromEntries(days.map((d) => [d, full(d)]));
    const p = text(leadParagraphs(input('week', '2026-09-28', by, '2026-10-20')));
    expect(p[0]).toBe(`In der Woche vom 28. September bis 4. Oktober hat die Anlage 700${NB}kWh produziert.`);
    expect(p[1]).toMatch(/^Die Schule hat 700 kWh verbraucht|^Die Schule hat \d+ kWh verbraucht, \d+ % davon/);
  });
  it('Monat April: Bereich 20. bis 30. April', () => {
    const days = periodDays('month', '2026-04-01');
    const by: Record<string, PartialCounters> = {};
    for (const d of days) by[d] = d >= '2026-04-20' ? full(d) : { yield: 100 };
    const p = text(leadParagraphs(input('month', '2026-04-01', by, '2026-10-20')));
    expect(p[0]).toBe(`Im April 2026 hat die Anlage 3.000${NB}kWh produziert.`);
    expect(p[1]).toMatch(/^Vom 20\. bis 30\. April hat die Schule 1\.210/);
    const en = text(leadParagraphs(input('month', '2026-04-01', by, '2026-10-20', 'en')));
    expect(en[1]).toMatch(/^From 20 to 30 April the school used 1,210/);
    expect(en[1]).toContain('of it did not come from the grid');
  });
  it('genau ein fehlender Tag: "(ohne 7. Oktober)"', () => {
    const days = periodDays('month', '2026-10-01').filter((d) => d !== '2026-10-07');
    const by = Object.fromEntries(days.map((d) => [d, full(d)]));
    const p = text(leadParagraphs(input('month', '2026-10-01', by, '2026-10-20')));
    // die Zeitangabe steht im ersten Satz und wird im zweiten nicht wiederholt
    expect(p[0]).toMatch(/^Im Oktober 2026 \(ohne 7\. Oktober\) hat die Anlage /);
    expect(p[1]).toMatch(/^Die Schule hat /);
    const en = text(leadParagraphs(input('month', '2026-10-01', by, '2026-10-20', 'en')));
    expect(en[0]).toMatch(/^In October 2026 \(excluding 7 October\) the system /);
    expect(en[1]).toMatch(/^The school consumed /);
  });
  it('Woche ohne jede Zeile: keine Daten', () => {
    expect(text(leadParagraphs(input('week', '2026-09-28', {}, '2026-10-20')))).toEqual(['Für diesen Zeitraum liegen keine Daten vor.']);
  });
  it('laufende Woche: "bisher"', () => {
    const by = { '2026-10-05': full('x'), '2026-10-06': full('x'), '2026-10-07': full('x') };
    expect(text(leadParagraphs(input('week', '2026-10-05', by, '2026-10-07')))[0]).toBe(
      `In der Woche vom 5. bis 11. Oktober hat die Anlage bisher 300${NB}kWh produziert.`,
    );
  });
  it('Jahr', () => {
    const by = { '2026-01-02': full('x') };
    expect(text(leadParagraphs(input('year', '2026-01-01', by, '2026-10-20')))[0]).toContain('Am 2. Jänner hat die Anlage');
  });
});

describe('Leitsatz: Bereich der Produktion', () => {
  const full = (): PartialCounters => c(100, 10, 10, 20, 10);
  it('Jahr mit fehlenden frühen Monaten', () => {
    const days = periodDays('year', '2026-01-01').filter((d) => d >= '2026-03-25' && d <= '2026-10-07');
    const by = Object.fromEntries(days.map((d) => [d, full()]));
    const de = text(leadParagraphs(input('year', '2026-01-01', by, '2026-10-07')))[0];
    expect(de).toMatch(/^Vom 25\. März bis 7\. Oktober hat die Anlage bisher /);
    const en = text(leadParagraphs(input('year', '2026-01-01', by, '2026-10-07', 'en')))[0];
    expect(en).toMatch(/^From 25 March to 7 October the system has produced /);
  });
  it('Monat mit einem Lückentag', () => {
    const days = periodDays('month', '2026-09-01').filter((d) => d !== '2026-09-16');
    const by = Object.fromEntries(days.map((d) => [d, full()]));
    expect(text(leadParagraphs(input('month', '2026-09-01', by, '2026-10-07')))[0]).toMatch(
      /^Im September 2026 \(ohne 16\. September\) hat die Anlage /,
    );
    expect(text(leadParagraphs(input('month', '2026-09-01', by, '2026-10-07', 'en')))[0]).toMatch(
      /^In September 2026 \(excluding 16 September\) the system produced /,
    );
  });
});

describe('Hilfsfunktionen', () => {
  it('rangeText über Monatsgrenze', () => {
    expect(rangeText('2026-03-28', '2026-04-03', 'de')).toBe('28. März bis 3. April');
    expect(rangeText('2026-03-28', '2026-04-03', 'en')).toBe('28 March to 3 April');
  });
  it('Kalenderwoche und Titel', () => {
    expect(isoWeek('2026-10-12')).toBe(42);
    expect(isoWeek('2026-01-01')).toBe(1);
    expect(isoWeek('2027-01-01')).toBe(53);
    expect(periodTitle({ view: 'week', key: '2026-10-12' }, 'de')).toBe('KW 42 · 12. bis 18. Oktober');
    expect(periodTitle({ view: 'month', key: '2026-09-01' }, 'en')).toBe('September 2026');
    expect(periodTitle({ view: 'year', key: '2026-01-01' }, 'de')).toBe('2026');
  });
  it('Live-Zeile mit Richtung in Worten', () => {
    const t = text([liveParts({ pv: 62.4, load: 54.3, grid: 8.1, battery: -3 }, 'de')])[0];
    expect(t).toBe(`Leistung jetzt: Produktion 62,4${NB}kW, Verbrauch 54,3${NB}kW, Netz 8,1${NB}kW Bezug, Batterie 3,0${NB}kW lädt`);
    expect(text([liveParts({ pv: 1, load: 1, grid: -2, battery: 0 }, 'en')])[0]).toContain('Grid 2.0');
    expect(text([liveParts({ pv: 1, load: 1, grid: -2, battery: 0 }, 'de')])[0]).toContain('Einspeisung, Batterie ruht');
  });
});
