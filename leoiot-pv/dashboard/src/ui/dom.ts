// Kleine Helfer zum Aufbau von Elementen ohne innerHTML (Werte sind nie Markup).
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  node.append(...children);
  return node;
}

/** Die Variable der Datenfarbe je Größe; der Name steht nur hier. */
export const QUANTITY_COLOR: Record<string, string> = {
  prod: '--c-pv',
  cons: '--c-verbrauch',
  self: '--c-pv',
  imp: '--c-netz',
  exp: '--c-netz',
  dis: '--c-batterie',
  chg: '--c-batterie',
};

/** Gestreift dargestellt: was ins Netz oder in die Batterie geht. */
export const HATCHED = new Set(['exp', 'chg']);

/** Ein Farbfeld in der Farbe der Größe (gestreift für Ins Netz / In Batterie). */
export function swatch(key: string): HTMLElement {
  const s = el('span', { class: 'sw' + (HATCHED.has(key) ? ' hatch' : ''), 'aria-hidden': 'true' });
  s.style.setProperty('--q', `var(${QUANTITY_COLOR[key]})`);
  return s;
}
