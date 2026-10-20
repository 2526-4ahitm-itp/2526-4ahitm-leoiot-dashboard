// Kopfleiste: Marke, Ansichten, Zeitraum wechseln (Titel öffnet die Datumsauswahl), Sprache, Darstellung.
import { TEXT, type Lang } from '../core/i18n';
import type { Route, View } from '../core/route';
import type { Theme } from './theme';
import { el } from './dom';
import { createDatePicker } from './datePicker';

export interface BarProps {
  lang: Lang;
  theme: Theme;
  view: View;
  key: string;
  title: string;
  canPrev: boolean;
  canNext: boolean;
  min: string | null;
  max: string;
  atToday: boolean;
}

export interface BarHandlers {
  onView(view: View): void;
  onStep(dir: -1 | 1): void;
  onPick(route: Route): void;
  onToday(): void;
  onLang(lang: Lang): void;
  onTheme(theme: Theme): void;
}

const VIEWS: View[] = ['day', 'week', 'month', 'year'];
const THEMES: Theme[] = ['light', 'dark'];
const SVG = 'http://www.w3.org/2000/svg';

function icon(paths: string[], extra: Record<string, string> = {}): SVGElement {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.setAttribute('class', 'ico');
  for (const [k, v] of Object.entries(extra)) svg.setAttribute(k, v);
  for (const d of paths) {
    const p = document.createElementNS(SVG, 'path');
    p.setAttribute('d', d);
    svg.append(p);
  }
  return svg;
}

const SUN = ['M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z', 'M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4'];
const MOON = ['M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z'];

export function createBar(root: HTMLElement, h: BarHandlers): { update(p: BarProps): void } {
  const brand = el('span', { class: 'brand' });
  const tabs = el('div', { class: 'seg tabs', role: 'tablist' });
  const tabButtons = VIEWS.map((v) => {
    const b = el('button', { type: 'button', role: 'tab', 'data-view': v });
    b.addEventListener('click', () => h.onView(v));
    b.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      const next = VIEWS[(VIEWS.indexOf(v) + (e.key === 'ArrowRight' ? 1 : VIEWS.length - 1)) % VIEWS.length];
      h.onView(next);
      queueMicrotask(() => tabButtons[VIEWS.indexOf(next)].focus());
    });
    return b;
  });
  tabs.append(...tabButtons);

  const prev = el('button', { type: 'button', class: 'btn icon' }, '‹');
  const next = el('button', { type: 'button', class: 'btn icon' }, '›');
  const titleText = el('span', { class: 'ttext' });
  const chevron = icon(['M6 9l6 6 6-6'], { fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
  const title = el('button', { type: 'button', class: 'btn ptitle', 'aria-haspopup': 'dialog', 'aria-expanded': 'false' }, titleText, chevron);
  const today = el('button', { type: 'button', class: 'btn todaybtn' });
  prev.addEventListener('click', () => h.onStep(-1));
  next.addEventListener('click', () => h.onStep(1));
  today.addEventListener('click', () => h.onToday());
  const stepper = el('div', { class: 'stepper', role: 'group' }, prev, title, next, today);
  const picker = createDatePicker(stepper, title, (r) => h.onPick(r));

  const langs = el('div', { class: 'seg', role: 'group' });
  const langButtons = (['de', 'en'] as Lang[]).map((l) => {
    const b = el('button', { type: 'button', lang: l }, l.toUpperCase());
    b.addEventListener('click', () => h.onLang(l));
    return b;
  });
  langs.append(...langButtons);

  const themes = el('div', { class: 'seg themeseg', role: 'group' });
  const themeLabels = THEMES.map(() => el('span', { class: 'lbl' }));
  const themeButtons = THEMES.map((t, i) => {
    const b = el('button', { type: 'button', 'data-theme-choice': t }, themeLabels[i]);
    b.prepend(icon(t === 'light' ? SUN : MOON, { fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
    b.addEventListener('click', () => h.onTheme(t));
    return b;
  });
  themes.append(...themeButtons);

  root.append(el('div', { class: 'bar-in' }, brand, tabs, stepper, el('div', { class: 'right' }, langs, themes)));

  return {
    update(p) {
      const L = TEXT[p.lang];
      brand.textContent = L.brand;
      tabs.setAttribute('aria-label', L.viewLabel);
      tabButtons.forEach((b, i) => {
        const on = VIEWS[i] === p.view;
        b.textContent = L.views[VIEWS[i]];
        b.setAttribute('aria-selected', String(on));
        b.tabIndex = on ? 0 : -1;
      });
      stepper.setAttribute('aria-label', L.period);
      prev.setAttribute('aria-label', L.prev);
      next.setAttribute('aria-label', L.next);
      prev.disabled = !p.canPrev;
      next.disabled = !p.canNext;
      titleText.textContent = p.title;
      title.setAttribute('aria-label', `${p.title}, ${L.chooseDate}`);
      today.textContent = L.today;
      today.disabled = p.atToday;
      picker.update({ view: p.view, key: p.key, lang: p.lang, min: p.min, max: p.max, today: p.max });
      langs.setAttribute('aria-label', L.language);
      langButtons.forEach((b, i) => b.setAttribute('aria-pressed', String((['de', 'en'] as Lang[])[i] === p.lang)));
      themes.setAttribute('aria-label', L.theme);
      themeButtons.forEach((b, i) => {
        const name = THEMES[i] === 'light' ? L.light : L.dark;
        themeLabels[i].textContent = name;
        b.setAttribute('aria-label', name);
        b.setAttribute('aria-pressed', String(THEMES[i] === p.theme));
      });
    },
  };
}
