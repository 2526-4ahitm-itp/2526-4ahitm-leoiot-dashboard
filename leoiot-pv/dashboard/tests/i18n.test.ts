import { describe, it, expect } from 'vitest';
import {
  TEXT,
  dateLong,
  dateShort,
  dayMonth,
  initialLang,
  kw,
  kwh,
  monthLabel,
  monthShort,
  pct,
  weekdayShort,
} from '../src/core/i18n';

function keyPaths(o: object, prefix = ''): string[] {
  return Object.entries(o).flatMap(([k, v]) =>
    typeof v === 'object' && v !== null ? keyPaths(v, prefix + k + '.') : [prefix + k],
  );
}

describe('Texte', () => {
  it('Deutsch und Englisch haben dieselben Schlüssel', () => {
    expect(keyPaths(TEXT.en).sort()).toEqual(keyPaths(TEXT.de).sort());
  });
  it('Größennamen laut Spec', () => {
    const q = TEXT.de.quantities;
    expect([q.production, q.consumption, q.selfConsumption, q.fromGrid, q.toGrid, q.fromBattery, q.toBattery]).toEqual([
      'Produktion', 'Verbrauch', 'Eigenverbrauch', 'Vom Netz', 'Ins Netz', 'Von Batterie', 'In Batterie',
    ]);
    expect(TEXT.de.autarky).toBe('Autarkie');
    expect(TEXT.de.selfRate).toBe('Eigenverbrauchsquote');
    expect(TEXT.de.noData).toBe('keine Daten');
    expect(TEXT.de.avg10).toBe('Ø letzte 10 Min');
    const e = TEXT.en.quantities;
    expect([e.production, e.consumption, e.selfConsumption, e.fromGrid, e.toGrid, e.fromBattery, e.toBattery]).toEqual([
      'Production', 'Consumption', 'Self-consumption', 'From grid', 'To grid', 'From battery', 'To battery',
    ]);
    expect(TEXT.en.autarky).toBe('Self-sufficiency');
    expect(TEXT.en.avg10).toBe('Avg. last 10 min');
  });
  it('Pluraltexte', () => {
    expect(TEXT.de.incomplete(1)).toBe('unvollständig, 1 Tag ohne Daten');
    expect(TEXT.en.incomplete(19)).toBe('incomplete, 19 days without data');
  });
});

describe('initialLang', () => {
  it('gespeicherte Wahl gewinnt', () => {
    expect(initialLang('de', 'en-US')).toBe('de');
    expect(initialLang('en', 'de-AT')).toBe('en');
  });
  it('sonst nach Browsersprache', () => {
    expect(initialLang(null, 'en-GB')).toBe('en');
    expect(initialLang(null, 'de-AT')).toBe('de');
    expect(initialLang(null, undefined)).toBe('de');
    expect(initialLang('fr', 'fr-FR')).toBe('de');
  });
});

describe('Zahlen', () => {
  it('Energie und Leistung je Sprache', () => {
    expect(kwh(12.5, 'de')).toBe('12,5\u00a0kWh');
    expect(kwh(12.5, 'en')).toBe('12.5\u00a0kWh');
    expect(kwh(1395.5, 'en')).toBe('1,396\u00a0kWh');
    expect(kwh(84312.4, 'de')).toBe('84.312\u00a0kWh');
    expect(kw(12.5, 'de')).toBe('12,5\u00a0kW');
    expect(kwh(null, 'de')).toBe('–');
  });
  it('Prozent ganzzahlig mit geschütztem Leerzeichen', () => {
    expect(pct(0.9494, 'de')).toBe('95\u00a0%');
    expect(pct(0.873, 'en')).toBe('87\u00a0%');
    expect(pct(null, 'de')).toBe('–');
  });
});

describe('Datum', () => {
  it('kurz', () => {
    expect(dateShort('2026-10-14', 'de')).toBe('14.10.2026');
    expect(dateShort('2026-10-14', 'en')).toBe('14 Oct 2026');
  });
  it('lang', () => {
    expect(dateLong('2026-10-14', 'de')).toBe('Mittwoch, 14. Oktober 2026');
    expect(dateLong('2026-10-14', 'en')).toBe('Wednesday, 14 October 2026');
  });
  it('Monat, Wochentag, Tag und Monat', () => {
    expect(monthLabel('2026-10-01', 'de')).toBe('Oktober 2026');
    expect(monthLabel('2026-10-01', 'en')).toBe('October 2026');
    expect(monthShort(10, 'de')).toBe('Okt');
    expect(weekdayShort('2026-10-14', 'de')).toBe('Mi');
    expect(weekdayShort('2026-10-14', 'en')).toBe('Wed');
    expect(dayMonth('2026-10-04', 'de')).toBe('04.10.');
    expect(dayMonth('2026-10-04', 'en')).toBe('4 Oct');
  });
});
