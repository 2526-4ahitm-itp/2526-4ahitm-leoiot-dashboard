// Kopfleiste: Marke, Ansichten, Zeitraum wechseln, Sprache, Darstellung.
import { TEXT, type Lang } from '../core/i18n';
import type { View } from '../core/route';
import type { Theme } from './theme';
import { el } from './dom';

export interface BarProps {
  lang: Lang;
  theme: Theme;
  view: View;
  title: string;
  canPrev: boolean;
  canNext: boolean;
  date: string;
  min: string;
  max: string;
  atToday: boolean;
}

export interface BarHandlers {
  onView(view: View): void;
  onStep(dir: -1 | 1): void;
  onDate(value: string): void;
  onToday(): void;
  onLang(lang: Lang): void;
  onTheme(): void;
}

const VIEWS: View[] = ['day', 'week', 'month', 'year'];

export function createBar(root: HTMLElement, h: BarHandlers): { update(p: BarProps): void } {
  const brand = el('span', { class: 'brand' });
  const tabs = el('div', { class: 'seg', role: 'tablist' });
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
  const title = el('span', { class: 'ptitle', 'aria-live': 'polite' });
  const date = el('input', { type: 'date', class: 'btn dateinput' });
  const today = el('button', { type: 'button', class: 'btn' });
  prev.addEventListener('click', () => h.onStep(-1));
  next.addEventListener('click', () => h.onStep(1));
  date.addEventListener('change', () => h.onDate(date.value));
  today.addEventListener('click', () => h.onToday());
  const stepper = el('div', { class: 'stepper', role: 'group' }, prev, title, next, date, today);

  const langs = el('div', { class: 'seg', role: 'group' });
  const langButtons = (['de', 'en'] as Lang[]).map((l) => {
    const b = el('button', { type: 'button', lang: l }, l.toUpperCase());
    b.addEventListener('click', () => h.onLang(l));
    return b;
  });
  langs.append(...langButtons);
  const theme = el('button', { type: 'button', class: 'btn' });
  theme.addEventListener('click', () => h.onTheme());

  root.append(el('div', { class: 'bar-in' }, brand, tabs, stepper, el('div', { class: 'right' }, langs, theme)));

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
      title.textContent = p.title;
      date.value = p.date;
      date.min = p.min;
      date.max = p.max;
      date.setAttribute('aria-label', L.chooseDate);
      today.textContent = L.today;
      today.disabled = p.atToday;
      langs.setAttribute('aria-label', L.language);
      langButtons.forEach((b, i) => b.setAttribute('aria-pressed', String((['de', 'en'] as Lang[])[i] === p.lang)));
      const target = p.theme === 'dark' ? L.light : L.dark;
      theme.textContent = target;
      theme.setAttribute('aria-label', `${L.theme}: ${target}`);
    },
  };
}
