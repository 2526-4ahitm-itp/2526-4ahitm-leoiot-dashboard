import { describe, it, expect } from 'vitest';
import { resolveTheme } from '../src/ui/theme';

describe('resolveTheme', () => {
  it('Adresse hat Vorrang', () => {
    expect(resolveTheme('?theme=dark', 'light')).toBe('dark');
    expect(resolveTheme('?theme=light', 'dark')).toBe('light');
    expect(resolveTheme('?foo=1&theme=dark', null)).toBe('dark');
  });
  it('sonst die gespeicherte Wahl', () => {
    expect(resolveTheme('', 'dark')).toBe('dark');
    expect(resolveTheme('?theme=blau', 'dark')).toBe('dark');
  });
  it('sonst hell', () => {
    expect(resolveTheme('', null)).toBe('light');
    expect(resolveTheme('?theme=blau', 'x')).toBe('light');
  });
});
