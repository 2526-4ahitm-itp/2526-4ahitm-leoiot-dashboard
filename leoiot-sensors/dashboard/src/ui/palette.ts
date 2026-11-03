import type { Palette } from '../core/chartOptions';

/** Reads the colours the charts need from the CSS variables in effect (so the theme decides them). */
export function readPalette(el: Element): Palette {
  const css = getComputedStyle(el);
  const v = (name: string) => css.getPropertyValue(name).trim();
  return {
    font: v('--font'),
    ink: v('--ink'),
    ink3: v('--ink-3'),
    line: v('--line'),
    lineStrong: v('--line-ctl'),
    panel: v('--panel'),
    humidity: v('--hum'),
    bandGood: v('--g-band'),
    bandSoon: v('--y-band'),
    bandBad: v('--r-band'),
  };
}
