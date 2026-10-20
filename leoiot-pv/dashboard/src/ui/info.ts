// Erklär-Knöpfe (ⓘ) mit einem kleinen Fenster; es ist immer höchstens eines offen (Design D12).
import { el } from './dom';

const SVG = 'http://www.w3.org/2000/svg';
const POP_ID = 'infoPop';

let openBtn: HTMLButtonElement | null = null;
let openKey: string | null = null;

const pop = (): HTMLElement => document.getElementById(POP_ID) as HTMLElement;

function icon(): SVGElement {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '18');
  svg.setAttribute('height', '18');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const c = document.createElementNS(SVG, 'circle');
  c.setAttribute('cx', '12');
  c.setAttribute('cy', '12');
  c.setAttribute('r', '9.5');
  const d = document.createElementNS(SVG, 'path');
  d.setAttribute('d', 'M12 11v6M12 7.2v.1');
  for (const n of [c, d]) {
    n.setAttribute('fill', 'none');
    n.setAttribute('stroke', 'currentColor');
    n.setAttribute('stroke-width', '2');
    n.setAttribute('stroke-linecap', 'round');
  }
  svg.append(c, d);
  return svg;
}

function place(btn: HTMLElement): void {
  const p = pop();
  const r = btn.getBoundingClientRect();
  const w = document.documentElement.clientWidth;
  const left = Math.max(8, Math.min(r.left + window.scrollX - 8, w - p.offsetWidth - 8 + window.scrollX));
  p.style.left = left + 'px';
  p.style.top = r.bottom + window.scrollY + 4 + 'px';
}

function show(btn: HTMLButtonElement): void {
  const p = pop();
  if (openBtn && openBtn !== btn) openBtn.setAttribute('aria-expanded', 'false');
  p.textContent = btn.dataset.text ?? '';
  p.hidden = false;
  btn.setAttribute('aria-expanded', 'true');
  openBtn = btn;
  openKey = btn.dataset.info ?? null;
  place(btn);
}

/** Schließt das Fenster; mit refocus geht der Fokus zurück auf den Knopf. */
export function closeInfo(refocus = false): void {
  const btn = openBtn;
  const p = document.getElementById(POP_ID);
  if (p) p.hidden = true;
  btn?.setAttribute('aria-expanded', 'false');
  openBtn = null;
  openKey = null;
  if (refocus && btn && btn.isConnected) btn.focus();
}

/** Nach einem Neuaufbau der Seite: ein offenes Fenster bleibt offen, solange sein Knopf noch da ist. */
export function refreshInfo(): void {
  const key = openKey;
  if (key === null) return;
  const btn = document.querySelector<HTMLButtonElement>(`button.infobtn[data-info="${key}"]`);
  if (btn) show(btn);
  else closeInfo();
}

/** Ein Erklär-Knopf; key ist je Größe eindeutig, name kommt in die Beschriftung für Screenreader. */
export function infoButton(key: string, label: string, text: string): HTMLButtonElement {
  const b = el('button', {
    type: 'button',
    class: 'infobtn',
    'data-info': key,
    'data-text': text,
    'aria-label': label,
    'aria-expanded': 'false',
    'aria-controls': POP_ID,
  });
  b.append(icon());
  b.addEventListener('click', () => (openBtn === b ? closeInfo(true) : show(b)));
  return b;
}

let wired = false;
/** Einmalig: Esc und Klick daneben schließen. */
export function wireInfo(): void {
  if (wired) return;
  wired = true;
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && openBtn) closeInfo(true);
  });
  document.addEventListener('pointerdown', (e) => {
    const t = e.target as Node;
    if (openBtn && !openBtn.contains(t) && !pop().contains(t)) closeInfo();
  });
  window.addEventListener('resize', () => closeInfo());
}
