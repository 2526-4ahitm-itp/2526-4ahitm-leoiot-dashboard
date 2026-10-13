// Die eine Stelle für Datenfarben im Code: Werte kommen aus den CSS-Variablen des Themes.
import type { Source } from '../core/energy';

export interface Colors {
  bg: string;
  ink: string;
  ink2: string;
  ink3: string;
  line: string;
  line2: string;
  pv: string;
  verbrauch: string;
  netz: string;
  batterie: string;
}

/** CSS-Variable je Herkunft; alle Felder lesen Datenfarben nur von hier. */
export const SOURCE_VAR: Record<Source, string> = {
  pv: '--c-pv',
  verbrauch: '--c-verbrauch',
  netz: '--c-netz',
  batterie: '--c-batterie',
};

/** Liest die Farben des aktuellen Themes aus den CSS-Variablen. */
export function readColors(): Colors {
  const style = getComputedStyle(document.documentElement);
  const get = (name: string): string => style.getPropertyValue(name).trim();
  return {
    bg: get('--bg'),
    ink: get('--ink'),
    ink2: get('--ink-2'),
    ink3: get('--ink-3'),
    line: get('--line'),
    line2: get('--line-2'),
    pv: get(SOURCE_VAR.pv),
    verbrauch: get(SOURCE_VAR.verbrauch),
    netz: get(SOURCE_VAR.netz),
    batterie: get(SOURCE_VAR.batterie),
  };
}

/** Farbe einer Herkunft aus den gelesenen Farben. */
export function sourceColor(colors: Colors, source: Source): string {
  return colors[source];
}

/** '#rrggbb' mit Deckkraft als rgba(). Reine Funktion. */
export function withAlpha(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}
