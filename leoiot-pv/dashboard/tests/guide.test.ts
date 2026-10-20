import { describe, it, expect } from 'vitest';
import { TEXT, type Lang } from '../src/core/i18n';
import { flowQuantityNames } from '../src/ui/guide';

describe('Skizze des Energieflusses', () => {
  for (const lang of ['de', 'en'] as Lang[]) {
    it(`nennt alle sieben Größen in ${lang}`, () => {
      expect([...flowQuantityNames(lang)].sort()).toEqual(Object.values(TEXT[lang].quantities).sort());
    });
  }
});
