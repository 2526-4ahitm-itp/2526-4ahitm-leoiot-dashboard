import { describe, it, expect } from 'vitest';
import { isValidKey, parseRoute, periodDays, periodStart, routeSearch, stepRoute } from '../src/core/route';

const TODAY = '2026-10-21'; // Mittwoch

describe('periodStart', () => {
  it('Tag 15.10.2026 als Woche beginnt am Montag 12.10.', () => {
    expect(periodStart('week', '2026-10-15')).toBe('2026-10-12');
  });
  it('Woche des 1.10.2026 beginnt am 28.9.', () => {
    expect(periodStart('week', '2026-10-01')).toBe('2026-09-28');
  });
  it('Sonntag gehört zur Woche davor', () => {
    expect(periodStart('week', '2026-10-18')).toBe('2026-10-12');
  });
  it('Monat und Jahr beginnen am Ersten', () => {
    expect(periodStart('month', '2026-10-15')).toBe('2026-10-01');
    expect(periodStart('year', '2026-10-15')).toBe('2026-01-01');
    expect(periodStart('day', '2026-10-15')).toBe('2026-10-15');
  });
});

describe('periodDays', () => {
  it('Woche über die Monatsgrenze: 28.9. bis 4.10.', () => {
    const d = periodDays('week', '2026-10-01');
    expect(d).toHaveLength(7);
    expect(d[0]).toBe('2026-09-28');
    expect(d[6]).toBe('2026-10-04');
  });
  it('Monate und Jahre haben die richtige Länge', () => {
    expect(periodDays('month', '2026-02-10')).toHaveLength(28);
    expect(periodDays('month', '2024-02-10')).toHaveLength(29);
    expect(periodDays('month', '2026-10-01')).toHaveLength(31);
    expect(periodDays('year', '2026-05-05')).toHaveLength(365);
    expect(periodDays('year', '2024-05-05')).toHaveLength(366);
    expect(periodDays('day', '2026-05-05')).toEqual(['2026-05-05']);
  });
});

describe('parseRoute', () => {
  it('ohne Adresse: Tag von heute', () => {
    expect(parseRoute('', TODAY)).toEqual({ view: 'day', key: TODAY });
  });
  it('Wechsel von Tag zu Woche: Woche 12. bis 18.10.', () => {
    expect(parseRoute('?view=week&date=2026-10-15', TODAY)).toEqual({ view: 'week', key: '2026-10-12' });
  });
  it('Monat mit YYYY-MM und mit vollem Datum', () => {
    expect(parseRoute('?view=month&date=2026-09', TODAY)).toEqual({ view: 'month', key: '2026-09-01' });
    expect(parseRoute('?view=month&date=2026-09-17', TODAY)).toEqual({ view: 'month', key: '2026-09-01' });
  });
  it('Jahr mit YYYY und mit vollem Datum', () => {
    expect(parseRoute('?view=year&date=2025', TODAY)).toEqual({ view: 'year', key: '2025-01-01' });
    expect(parseRoute('?view=year&date=2025-06-06', TODAY)).toEqual({ view: 'year', key: '2025-01-01' });
  });
  it('geteilter Link zum Monat September 2026', () => {
    expect(parseRoute(routeSearch({ view: 'month', key: '2026-09-01' }), TODAY)).toEqual({
      view: 'month',
      key: '2026-09-01',
    });
  });
  it('kaputte Adresse: unmögliches Datum 2026-02-30 ergibt heute', () => {
    expect(parseRoute('?view=day&date=2026-02-30', TODAY)).toEqual({ view: 'day', key: TODAY });
  });
  it('unbekannte Ansicht oder Unsinn ergibt heute', () => {
    expect(parseRoute('?view=decade&date=2026-10-01', TODAY)).toEqual({ view: 'day', key: TODAY });
    expect(parseRoute('?view=day&date=gestern', TODAY)).toEqual({ view: 'day', key: TODAY });
  });
  it('Zeitraum nach heute ergibt heute', () => {
    expect(parseRoute('?view=day&date=2026-10-22', TODAY)).toEqual({ view: 'day', key: TODAY });
    expect(parseRoute('?view=month&date=2026-11', TODAY)).toEqual({ view: 'day', key: TODAY });
    expect(parseRoute('?view=year&date=2027', TODAY)).toEqual({ view: 'day', key: TODAY });
  });
  it('laufender Zeitraum ist erreichbar, auch wenn er vor heute beginnt', () => {
    expect(parseRoute('?view=week&date=2026-10-21', TODAY)).toEqual({ view: 'week', key: '2026-10-19' });
  });
});

describe('routeSearch', () => {
  it('Adressformen je Ansicht', () => {
    expect(routeSearch({ view: 'day', key: '2026-10-14' })).toBe('?view=day&date=2026-10-14');
    expect(routeSearch({ view: 'week', key: '2026-10-12' })).toBe('?view=week&date=2026-10-12');
    expect(routeSearch({ view: 'month', key: '2026-09-01' })).toBe('?view=month&date=2026-09');
    expect(routeSearch({ view: 'year', key: '2026-01-01' })).toBe('?view=year&date=2026');
  });
});

describe('stepRoute', () => {
  it('Oktober 2026 zurück ergibt September', () => {
    expect(stepRoute({ view: 'month', key: '2026-10-01' }, -1, TODAY, null)).toEqual({ view: 'month', key: '2026-09-01' });
  });
  it('Januar zurück ergibt Dezember des Vorjahrs', () => {
    expect(stepRoute({ view: 'month', key: '2026-01-01' }, -1, TODAY, null)).toEqual({ view: 'month', key: '2025-12-01' });
  });
  it('Woche und Tag und Jahr', () => {
    expect(stepRoute({ view: 'week', key: '2026-10-12' }, 1, TODAY, null)).toEqual({ view: 'week', key: '2026-10-19' });
    expect(stepRoute({ view: 'day', key: '2026-10-01' }, -1, TODAY, null)).toEqual({ view: 'day', key: '2026-09-30' });
    expect(stepRoute({ view: 'year', key: '2026-01-01' }, -1, TODAY, null)).toEqual({ view: 'year', key: '2025-01-01' });
  });
  it('von der aktuellen Woche gibt es kein Weiter', () => {
    expect(stepRoute({ view: 'week', key: '2026-10-19' }, 1, TODAY, null)).toBeNull();
  });
  it('vom heutigen Tag, Monat und Jahr gibt es kein Weiter', () => {
    expect(stepRoute({ view: 'day', key: TODAY }, 1, TODAY, null)).toBeNull();
    expect(stepRoute({ view: 'month', key: '2026-10-01' }, 1, TODAY, null)).toBeNull();
    expect(stepRoute({ view: 'year', key: '2026-01-01' }, 1, TODAY, null)).toBeNull();
  });
  it('Zurück endet im Zeitraum des frühesten Werts', () => {
    expect(stepRoute({ view: 'month', key: '2026-02-01' }, -1, TODAY, '2026-01-15')).toEqual({ view: 'month', key: '2026-01-01' });
    expect(stepRoute({ view: 'month', key: '2026-01-01' }, -1, TODAY, '2026-01-15')).toBeNull();
    expect(stepRoute({ view: 'day', key: '2026-01-16' }, -1, TODAY, '2026-01-15')).toEqual({ view: 'day', key: '2026-01-15' });
    expect(stepRoute({ view: 'day', key: '2026-01-15' }, -1, TODAY, '2026-01-15')).toBeNull();
    expect(stepRoute({ view: 'week', key: '2026-01-19' }, -1, TODAY, '2026-01-15')).toEqual({ view: 'week', key: '2026-01-12' });
    expect(stepRoute({ view: 'week', key: '2026-01-12' }, -1, TODAY, '2026-01-15')).toBeNull();
  });
});

describe('isValidKey', () => {
  it('prüft echte Kalendertage', () => {
    expect(isValidKey('2026-02-28')).toBe(true);
    expect(isValidKey('2024-02-29')).toBe(true);
    expect(isValidKey('2026-02-29')).toBe(false);
    expect(isValidKey('2026-13-01')).toBe(false);
    expect(isValidKey('2026-10')).toBe(false);
  });
});
