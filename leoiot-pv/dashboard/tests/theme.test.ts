import { describe, it, expect } from 'vitest';
import { applyTheme, initialTheme } from '../src/ui/theme';

describe('initialTheme', () => {
  it('gespeicherte Wahl gewinnt', () => {
    expect(initialTheme('light', true)).toBe('light');
    expect(initialTheme('dark', false)).toBe('dark');
  });
  it('sonst das System', () => {
    expect(initialTheme(null, true)).toBe('dark');
    expect(initialTheme(null, false)).toBe('light');
    expect(initialTheme('blau', true)).toBe('dark');
  });
});

describe('applyTheme', () => {
  it('setzt data-theme am Wurzelelement', () => {
    const root = { dataset: {} } as unknown as HTMLElement;
    applyTheme('dark', root);
    expect(root.dataset.theme).toBe('dark');
  });
});
