import { describe, it, expect } from 'vitest';
import { MISSING } from '../src/core/format';
import { updatedText } from '../src/ui/header';

describe('updatedText', () => {
  it('ohne Daten der Platzhalter', () => {
    expect(updatedText(null)).toBe(MISSING);
  });
  it('Wiener Zeit', () => {
    expect(updatedText(Date.parse('2026-10-07T08:05:00Z'))).toBe('10:05');
  });
});
