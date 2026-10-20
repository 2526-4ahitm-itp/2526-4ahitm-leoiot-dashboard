import { describe, it, expect } from 'vitest';
import { EXPLAIN_KEYS, TEXT, type Lang } from '../src/core/i18n';

describe('Erklärungen', () => {
  for (const lang of ['de', 'en'] as Lang[]) {
    it(`jeder Schlüssel hat in ${lang} einen nicht leeren Text`, () => {
      for (const k of EXPLAIN_KEYS) {
        expect(TEXT[lang].explain[k], k).toBeTruthy();
        expect(TEXT[lang].explain[k].trim().length, k).toBeGreaterThan(10);
      }
      expect(Object.keys(TEXT[lang].explain).sort()).toEqual([...EXPLAIN_KEYS].sort());
      for (const k of Object.keys(TEXT[lang].names)) expect((TEXT[lang].names as Record<string, string>)[k]).toBeTruthy();
    });
  }
  it('Leseführer: vier Formeln und alle Abschnitte in beiden Sprachen', () => {
    for (const lang of ['de', 'en'] as Lang[]) {
      const g = TEXT[lang].guide;
      expect(g.formulas).toHaveLength(4);
      for (const v of [g.summary, g.kwText, g.noDataText, g.sourceText, g.flowAlt, g.plant, g.school, g.grid, g.battery]) expect(v.length).toBeGreaterThan(0);
    }
    expect(TEXT.de.guide.summary).toBe('So lesen Sie das Dashboard');
    expect(TEXT.en.guide.summary).toBe('How to read this dashboard');
  });
});
