// "So lesen Sie das Dashboard": Text, Formeln und die Skizze des Energieflusses (Inline-SVG aus den Datenfarben).
import { TEXT, type Lang } from '../core/i18n';
import { el, QUANTITY_COLOR } from './dom';

const SVG = 'http://www.w3.org/2000/svg';

function s<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string>, ...kids: (Node | string)[]): SVGElementTagNameMap[K] {
  const n = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  n.append(...kids);
  return n;
}

interface Arrow {
  q: 'self' | 'imp' | 'exp' | 'dis' | 'chg';
  d: string;
  label: { x: number; y: number }; // linke Kante des Farbfelds, Grundlinie des Namens
  out: boolean; // geht aus der Schule heraus: gestrichelt wie die Streifen im Diagramm
}

const ARROWS: Arrow[] = [
  { q: 'self', d: 'M100 130 H252', label: { x: 138, y: 120 }, out: false },
  { q: 'exp', d: 'M55 100 V28 H127', label: { x: 63, y: 70 }, out: true },
  { q: 'imp', d: 'M233 28 H305 V92', label: { x: 212, y: 70 }, out: false },
  { q: 'chg', d: 'M55 160 V232 H127', label: { x: 63, y: 200 }, out: true },
  { q: 'dis', d: 'M233 232 H305 V168', label: { x: 212, y: 200 }, out: false },
];

const ARROW_NAME = { self: 'selfConsumption', imp: 'fromGrid', exp: 'toGrid', dis: 'fromBattery', chg: 'toBattery' } as const;

/** Die sieben Größennamen, die die Skizze zeigt: fünf an den Pfeilen, zwei an Anlage und Schule. */
export function flowQuantityNames(lang: Lang): string[] {
  const q = TEXT[lang].quantities;
  return [...ARROWS.map((a) => q[ARROW_NAME[a.q]]), q.production, q.consumption];
}

const COLORS = ['--c-pv', '--c-verbrauch', '--c-netz', '--c-batterie'];

function flowSketch(lang: Lang): SVGElement {
  const L = TEXT[lang];
  const name = (k: Arrow['q']): string => L.quantities[ARROW_NAME[k]];
  const svg = s('svg', { viewBox: '0 0 360 260', role: 'img', class: 'flow', 'aria-label': L.guide.flowAlt });
  svg.append(
    s(
      'defs',
      {},
      ...COLORS.map((c) =>
        s('marker', { id: `arr${c}`, viewBox: '0 0 10 10', refX: '8', refY: '5', markerWidth: '7', markerHeight: '7', orient: 'auto' }, s('path', { d: 'M0 0 L10 5 L0 10 z', style: `fill:var(${c})` })),
      ),
    ),
  );
  const box = (x: number, y: number, w: number, h: number, title: string, sub?: { text: string; color: string }): SVGElement => {
    const g = s('g', {}, s('rect', { x: String(x), y: String(y), width: String(w), height: String(h), rx: '10', class: 'fbox' }));
    const t = s('text', { x: String(x + w / 2), y: String(y + (sub ? h / 2 - 3 : h / 2 + 5)), 'text-anchor': 'middle', class: 'fname' }, title);
    g.append(t);
    if (sub) {
      g.append(s('text', { x: String(x + w / 2), y: String(y + h / 2 + 15), 'text-anchor': 'middle', class: 'fsub' }, sub.text));
      g.append(s('rect', { x: String(x + 12), y: String(y + h - 7), width: String(w - 24), height: '3', rx: '1.5', style: `fill:var(${sub.color})` }));
    }
    return g;
  };
  for (const a of ARROWS) {
    const color = QUANTITY_COLOR[a.q];
    svg.append(
      s('path', {
        d: a.d,
        fill: 'none',
        'stroke-width': '3',
        'stroke-linejoin': 'round',
        ...(a.out ? { 'stroke-dasharray': '7 4' } : {}),
        'marker-end': `url(#arr${color})`,
        style: `stroke:var(${color})`,
      }),
    );
    svg.append(
      s('rect', { x: String(a.label.x), y: String(a.label.y - 11), width: '11', height: '11', rx: '2', style: `fill:var(${color})`, class: a.out ? 'fhatch' : '' }),
    );
    svg.append(
      s('text', { x: String(a.label.x + 16), y: String(a.label.y), class: 'flabel' }, name(a.q)),
    );
  }
  svg.append(
    box(10, 100, 90, 60, L.guide.plant, { text: L.quantities.production, color: '--c-pv' }),
    box(260, 100, 90, 60, L.guide.school, { text: L.quantities.consumption, color: '--c-verbrauch' }),
    box(127, 8, 106, 40, L.guide.grid),
    box(127, 212, 106, 40, L.guide.battery),
  );
  return svg;
}

/** Füllt den Inhalt des Leseführers neu (die Sektion selbst und ihr Öffnungszustand bleiben). */
export function renderGuide(summary: HTMLElement, body: HTMLElement, lang: Lang): void {
  const g = TEXT[lang].guide;
  summary.textContent = g.summary;
  body.replaceChildren(
    el('h3', {}, g.kwTitle),
    el('p', {}, g.kwText),
    el('h3', {}, g.flowTitle),
    flowSketch(lang),
    el('h3', {}, g.formulasTitle),
    el('ul', { class: 'formulas' }, ...g.formulas.map((f) => el('li', {}, f))),
    el('h3', {}, g.noDataTitle),
    el('p', {}, g.noDataText),
    el('h3', {}, g.sourceTitle),
    el('p', {}, g.sourceText),
  );
}
