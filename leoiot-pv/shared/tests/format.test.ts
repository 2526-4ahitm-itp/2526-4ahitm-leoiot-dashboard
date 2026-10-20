import { describe, it, expect } from 'vitest';
import {
  MISSING,
  NBSP,
  formatNumber,
  formatKwh,
  formatKw,
  formatTick,
} from '../src/format';

describe('format', () => {
  describe('formatNumber', () => {
    it('formatNumber(12.5) === "12,5"', () => {
      expect(formatNumber(12.5)).toBe('12,5');
    });

    it('formatNumber(99.9) === "99,9"', () => {
      expect(formatNumber(99.9)).toBe('99,9');
    });

    it('formatNumber(100) === "100"', () => {
      expect(formatNumber(100)).toBe('100');
    });

    it('formatNumber(99.96) === "100" (rundet über die Grenze)', () => {
      expect(formatNumber(99.96)).toBe('100');
    });

    it('formatNumber(99.94) === "99,9"', () => {
      expect(formatNumber(99.94)).toBe('99,9');
    });

    it('formatNumber(0) === "0,0"', () => {
      expect(formatNumber(0)).toBe('0,0');
    });

    it('formatNumber(-0.04) === "0,0"', () => {
      expect(formatNumber(-0.04)).toBe('0,0');
    });

    it('formatNumber(7) === "7,0"', () => {
      expect(formatNumber(7)).toBe('7,0');
    });

    it('formatNumber(663.8) === "664"', () => {
      expect(formatNumber(663.8)).toBe('664');
    });

    it('formatNumber(1012) === "1012"', () => {
      expect(formatNumber(1012)).toBe('1012');
    });

    it('formatNumber(12345.6) === "12346"', () => {
      expect(formatNumber(12345.6)).toBe('12346');
    });

    it('formatNumber(-80) === "-80,0"', () => {
      expect(formatNumber(-80)).toBe('-80,0');
    });

    it('formatNumber(null) === MISSING', () => {
      expect(formatNumber(null)).toBe('–');
    });

    it('formatNumber(undefined) === MISSING', () => {
      expect(formatNumber(undefined)).toBe('–');
    });

    it('formatNumber(NaN) === MISSING', () => {
      expect(formatNumber(NaN)).toBe('–');
    });

    it('formatNumber(Infinity) === MISSING', () => {
      expect(formatNumber(Infinity)).toBe('–');
    });

    it('formatNumber(-Infinity) === MISSING', () => {
      expect(formatNumber(-Infinity)).toBe('–');
    });
  });

  describe('formatKwh', () => {
    it('formatKwh(82.4) === "82,4 kWh"', () => {
      expect(formatKwh(82.4)).toBe('82,4\u00a0kWh');
    });

    it('formatKwh(746.2) === "746 kWh"', () => {
      expect(formatKwh(746.2)).toBe('746\u00a0kWh');
    });

    it('formatKwh(null) === MISSING', () => {
      expect(formatKwh(null)).toBe('–');
    });
  });

  describe('formatKw', () => {
    it('formatKw(12.5) === "12,5 kW"', () => {
      expect(formatKw(12.5)).toBe('12,5\u00a0kW');
    });

    it('formatKw(undefined) === MISSING', () => {
      expect(formatKw(undefined)).toBe('–');
    });
  });

  describe('formatTick', () => {
    it('formatTick(0) === "0"', () => {
      expect(formatTick(0)).toBe('0');
    });

    it('formatTick(20) === "20"', () => {
      expect(formatTick(20)).toBe('20');
    });

    it('formatTick(150) === "150"', () => {
      expect(formatTick(150)).toBe('150');
    });

    it('formatTick(12.5) === "12,5"', () => {
      expect(formatTick(12.5)).toBe('12,5');
    });

    it('formatTick(2.5) === "2,5"', () => {
      expect(formatTick(2.5)).toBe('2,5');
    });

    it('formatTick(NaN) === MISSING', () => {
      expect(formatTick(NaN)).toBe('–');
    });
  });

  describe('no decimal points in results', () => {
    it('formatNumber(0.5) does not contain "."', () => {
      expect(formatNumber(0.5)).not.toContain('.');
    });

    it('formatNumber(12.5) does not contain "."', () => {
      expect(formatNumber(12.5)).not.toContain('.');
    });

    it('formatNumber(99.9) does not contain "."', () => {
      expect(formatNumber(99.9)).not.toContain('.');
    });

    it('formatNumber(100) does not contain "."', () => {
      expect(formatNumber(100)).not.toContain('.');
    });

    it('formatNumber(1012.34) does not contain "."', () => {
      expect(formatNumber(1012.34)).not.toContain('.');
    });

    it('formatKwh(0.5) does not contain "."', () => {
      expect(formatKwh(0.5)).not.toContain('.');
    });

    it('formatKwh(12.5) does not contain "."', () => {
      expect(formatKwh(12.5)).not.toContain('.');
    });

    it('formatKwh(99.9) does not contain "."', () => {
      expect(formatKwh(99.9)).not.toContain('.');
    });

    it('formatKwh(100) does not contain "."', () => {
      expect(formatKwh(100)).not.toContain('.');
    });

    it('formatKwh(1012.34) does not contain "."', () => {
      expect(formatKwh(1012.34)).not.toContain('.');
    });

    it('formatKw(0.5) does not contain "."', () => {
      expect(formatKw(0.5)).not.toContain('.');
    });

    it('formatKw(12.5) does not contain "."', () => {
      expect(formatKw(12.5)).not.toContain('.');
    });

    it('formatKw(99.9) does not contain "."', () => {
      expect(formatKw(99.9)).not.toContain('.');
    });

    it('formatKw(100) does not contain "."', () => {
      expect(formatKw(100)).not.toContain('.');
    });

    it('formatKw(1012.34) does not contain "."', () => {
      expect(formatKw(1012.34)).not.toContain('.');
    });

    it('formatTick(0.5) does not contain "."', () => {
      expect(formatTick(0.5)).not.toContain('.');
    });

    it('formatTick(12.5) does not contain "."', () => {
      expect(formatTick(12.5)).not.toContain('.');
    });

    it('formatTick(99.9) does not contain "."', () => {
      expect(formatTick(99.9)).not.toContain('.');
    });

    it('formatTick(100) does not contain "."', () => {
      expect(formatTick(100)).not.toContain('.');
    });

    it('formatTick(1012.34) does not contain "."', () => {
      expect(formatTick(1012.34)).not.toContain('.');
    });
  });

  describe('constants', () => {
    it('MISSING should be "–" (U+2013)', () => {
      expect(MISSING).toBe('–');
    });

    it('NBSP ist ein geschütztes Leerzeichen', () => {
      expect(NBSP).toBe('\u00a0');
    });
  });

  describe('Sprache und Tausendertrennung (Dashboard)', () => {
    it('ohne Angabe bleibt alles wie im Kiosk: 1012 ohne Trennung, Dezimalkomma', () => {
      expect(formatNumber(1012)).toBe('1012');
      expect(formatNumber(12.5)).toBe('12,5');
    });

    it('Englisch: 12.5 liest sich "12.5"', () => {
      expect(formatNumber(12.5, { lang: 'en' })).toBe('12.5');
    });

    it('Englisch mit Trennung: 1395.5 liest sich "1,396"', () => {
      expect(formatNumber(1395.5, { lang: 'en', group: true })).toBe('1,396');
    });

    it('Deutsch mit Trennung: 84312.4 liest sich "84.312"', () => {
      expect(formatNumber(84312.4, { lang: 'de', group: true })).toBe('84.312');
    });

    it('Trennung erst ab 1000 und auch bei negativen Werten', () => {
      expect(formatNumber(999.6, { group: true })).toBe('1.000');
      expect(formatNumber(356, { group: true })).toBe('356');
      expect(formatNumber(-1234.6, { group: true })).toBe('-1.235');
    });

    it('Einheiten und Achsen reichen die Schreibweise weiter', () => {
      expect(formatKwh(12.5, { lang: 'en' })).toBe('12.5' + NBSP + 'kWh');
      expect(formatKw(62.4, { lang: 'en' })).toBe('62.4' + NBSP + 'kW');
      expect(formatTick(2000, { group: true })).toBe('2.000');
      expect(formatTick(2.5, { lang: 'en' })).toBe('2.5');
      expect(formatKwh(null, { lang: 'en' })).toBe(MISSING);
    });
  });
});
