import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

type Group = Record<string, string>;
type Tokens = { base: Group; light: Group; dark: Group };

export function parseTokens(css: string): Tokens {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const out: Tokens = { base: {}, light: {}, dark: {} };
  for (const m of clean.matchAll(/(:root[^{}]*)\{([^{}]*)\}/g)) {
    const selector = m[1];
    const hasDark = selector.includes('dark');
    const hasLight = selector.includes('light');
    const group = hasDark && hasLight ? out.base : hasDark ? out.dark : out.light;
    for (const t of m[2].matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
      group[t[1]] = t[2].trim().replace(/\s+/g, ' ');
    }
  }
  return out;
}

const dir = dirname(fileURLToPath(import.meta.url));
const dashboard = parseTokens(readFileSync(resolve(dir, '../src/styles/tokens.css'), 'utf8'));
const doku = parseTokens(readFileSync(resolve(dir, '../../../src/styles/tokens.css'), 'utf8'));
const groups = ['base', 'light', 'dark'] as const;

describe('Dashboard-Tokens', () => {
  it('gemeinsame Tokens haben identische Werte', () => {
    let verglichen = 0;
    for (const g of groups) {
      for (const [name, wert] of Object.entries(dashboard[g])) {
        if (name in doku[g]) {
          verglichen++;
          expect(wert, `${name} (${g})`).toBe(doku[g][name]);
        }
      }
    }
    expect(verglichen).toBeGreaterThan(25);
  });

  it('nur erlaubte eigene Tokens', () => {
    for (const g of groups) {
      for (const name of Object.keys(dashboard[g])) {
        const inDoku = groups.some((h) => name in doku[h]);
        if (!inDoku) {
          expect(/^--c-/.test(name), `${name} ist kein --c-*`).toBe(true);
        }
      }
    }
  });

  it('Datenfarben in beiden Themes', () => {
    for (const name of ['--c-pv', '--c-verbrauch', '--c-netz', '--c-batterie']) {
      expect(dashboard.light[name], `${name} hell`).toBeDefined();
      expect(dashboard.dark[name], `${name} dunkel`).toBeDefined();
    }
  });
});
