import '../styles/flow.css';
import { SOURCE_VAR } from '../ui/colors';
import type { PanelFactory } from '../ui/panel';
import { flowModel, type FlowId } from './flowModel';

const NS = 'http://www.w3.org/2000/svg';
const HUB = { x: 450, y: 165 };
const R = 36; // Knotenradius
const HR = 8; // Radius des Mittelpunkts

const ICONS = {
  solar:
    '<path d="M-14 8 L-8 -9 H14 L8 8 Z"/><path d="M-11 -0.5 H11"/><path d="M-1 -9 L-3.5 8"/><path d="M5 -9 L2.5 8"/><path d="M-3 8 V15 M-9 15 H5"/>',
  haus: '<path d="M-17 0 L0 -15 L17 0"/><path d="M-12 -4 V15 H12 V-4"/><path d="M-3.5 15 V5 H3.5 V15"/>',
  mast: '<path d="M0 -16 L-8 16 M0 -16 L8 16"/><path d="M-12 -8 H12"/><path d="M-9 2 H9"/><path d="M-5 -8 L5 2 M5 -8 L-5 2"/>',
  akku: '<rect x="-15" y="-9" width="26" height="18" rx="3"/><path d="M15 -3.5 V3.5"/><path d="M-8 -3 V3 M-2 -3 V3 M4 -3 V3"/>',
};

interface Def {
  id: FlowId;
  x: number;
  y: number;
  icon: keyof typeof ICONS;
  right: boolean; // Text rechts neben dem Knoten, sonst darunter
}

const DEFS: Def[] = [
  { id: 'pv', x: 450, y: 48, icon: 'solar', right: true },
  { id: 'load', x: 120, y: 165, icon: 'haus', right: false },
  { id: 'grid', x: 780, y: 165, icon: 'mast', right: false },
  { id: 'battery', x: 450, y: 282, icon: 'akku', right: true },
];

interface Parts {
  line: SVGPathElement;
  arrow: SVGPolygonElement;
  circle: SVGCircleElement;
  name: SVGTextElement;
  val: SVGTextElement;
  word: SVGTextElement;
  toHub: boolean | null; // Richtung, für die d gesetzt ist
}

function el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}): SVGElementTagNameMap[K] {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, String(attrs[k]));
  return e;
}

const f = (n: number): string => n.toFixed(1);

export const createFlowPanel: PanelFactory = (field) => {
  const content = field.querySelector('.content') as HTMLElement;
  const box = document.createElement('div');
  box.className = 'chartbox';
  const svg = el('svg', { viewBox: '0 0 900 360', preserveAspectRatio: 'xMidYMid meet', role: 'img' });
  box.appendChild(svg);
  content.appendChild(box);

  // Zeichenreihenfolge: Linien, Mittelpunkt, Pfeile, Knoten
  const parts = new Map<FlowId, Parts>();
  const gLines = el('g');
  const gArrows = el('g');
  const gNodes = el('g');
  for (const d of DEFS) {
    const line = el('path', { class: 'fl' });
    const arrow = el('polygon', { class: 'arrow' });
    arrow.style.display = 'none';
    const circle = el('circle', { cx: d.x, cy: d.y, r: R });
    circle.style.fill = 'var(--bg)';
    circle.style.strokeWidth = '3.5';
    const ico = el('g', { class: 'ico', transform: `translate(${d.x} ${d.y}) scale(1.05)` });
    ico.innerHTML = ICONS[d.icon];
    const tx = d.right ? d.x + R + 18 : d.x;
    const anchor = d.right ? 'start' : 'middle';
    const ys = d.right ? [d.y - 18, d.y + 17, d.y + 45] : [d.y + R + 32, d.y + R + 72, d.y + R + 102];
    const name = el('text', { x: tx, y: ys[0], class: 't-name', 'text-anchor': anchor });
    const val = el('text', { x: tx, y: ys[1], class: 't-val', 'text-anchor': anchor });
    const word = el('text', { x: tx, y: ys[2], class: 't-word', 'text-anchor': anchor });
    gLines.appendChild(line);
    gArrows.appendChild(arrow);
    gNodes.append(circle, ico, name, val, word);
    parts.set(d.id, { line, arrow, circle, name, val, word, toHub: null });
  }
  const hub = el('circle', { cx: HUB.x, cy: HUB.y, r: HR });
  hub.style.fill = 'var(--bg)';
  hub.style.stroke = 'var(--ink-3)';
  hub.style.strokeWidth = '2.5';
  svg.append(gLines, hub, gArrows, gNodes);

  const sourceEl = document.getElementById('flowSource');
  let signature = '';
  let label = '';

  const setText = (t: SVGTextElement, s: string): void => {
    if (t.textContent !== s) t.textContent = s;
  };

  return {
    update(view) {
      const m = flowModel(view.flow);
      if (!m) return;
      const sig = JSON.stringify(m);
      if (sig === signature) return;
      signature = sig;

      for (const node of m.nodes) {
        const d = DEFS.find((x) => x.id === node.id) as Def;
        const p = parts.get(node.id) as Parts;
        const color = 'var(' + SOURCE_VAR[node.source] + ')';

        // Linie und Pfeil laufen immer in Flussrichtung
        const dx = HUB.x - d.x;
        const dy = HUB.y - d.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        const ux = dx / len;
        const uy = dy / len;
        const ne = { x: d.x + ux * R, y: d.y + uy * R };
        const he = { x: HUB.x - ux * HR, y: HUB.y - uy * HR };
        const s = node.toHub ? ne : he;
        const e = node.toHub ? he : ne;
        if (p.toHub !== node.toHub) {
          p.toHub = node.toHub;
          p.line.setAttribute('d', `M${f(s.x)} ${f(s.y)} L${f(e.x)} ${f(e.y)}`);
        }

        if (node.active) {
          p.line.setAttribute('class', 'fl on');
          p.line.style.stroke = color;
          const dir = node.toHub ? { x: ux, y: uy } : { x: -ux, y: -uy };
          const mx = (s.x + e.x) / 2;
          const my = (s.y + e.y) / 2;
          const px = -dir.y;
          const py = dir.x;
          const pts = [
            [mx + dir.x * 11, my + dir.y * 11],
            [mx - dir.x * 8 + px * 9, my - dir.y * 8 + py * 9],
            [mx - dir.x * 8 - px * 9, my - dir.y * 8 - py * 9],
          ];
          p.arrow.setAttribute('points', pts.map((q) => f(q[0]) + ',' + f(q[1])).join(' '));
          p.arrow.style.display = '';
          p.arrow.style.fill = color;
        } else {
          p.line.setAttribute('class', 'fl');
          p.line.style.stroke = 'var(--line-2)';
          p.arrow.style.display = 'none';
        }

        p.circle.style.fill = 'var(--bg)';
        p.circle.style.stroke = color;
        p.circle.style.strokeWidth = '3.5';
        p.circle.style.strokeOpacity = node.active ? '1' : '0.5';
        setText(p.name, node.name);
        setText(p.val, node.value);
        setText(p.word, node.word);
      }
      svg.setAttribute('aria-label', m.summary);

      if (sourceEl && label !== m.sourceLabel) {
        label = m.sourceLabel;
        sourceEl.replaceChildren();
        if (m.live) {
          const dot = document.createElement('i');
          dot.className = 'dot';
          sourceEl.appendChild(dot);
        }
        sourceEl.appendChild(document.createTextNode(m.sourceLabel));
      }
    },
    restyle() {},
  };
};
