import { describe, it, expect } from 'vitest';
import { SOURCE_VAR, withAlpha } from '../src/ui/colors';

describe('colors', () => {
  it('withAlpha', () => {
    expect(withAlpha('#1baf7a', 0.1)).toBe('rgba(27,175,122,0.1)');
  });
  it('SOURCE_VAR hat die vier Herkünfte', () => {
    expect(Object.keys(SOURCE_VAR).sort()).toEqual(['batterie', 'netz', 'pv', 'verbrauch']);
  });
});
