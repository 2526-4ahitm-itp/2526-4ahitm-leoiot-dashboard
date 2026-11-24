// The panel under the date segment: two date fields, validation, apply. It uses the browser's
// popover when there is one and a plain hidden/shown panel with its own Escape and outside-click
// handling otherwise. The pure helpers are exported for tests.
import { localDate, localMidnight, makeFormat, shiftDate } from '../core/format';
import { texts, type Lang } from '../core/i18n';
import { allowedDates, validateDates, type DatesCheck, type Selection } from '../core/ranges';
import type { Dom } from './render';

/** The days the fields start with: the shown dates, else 7 days ago to today. */
export function prefillDates(sel: Selection, now: number): { from: string; to: string } {
  if (sel.kind === 'dates') return { from: sel.from, to: sel.to };
  const to = localDate(now);
  return { from: shiftDate(to, -7), to };
}

/** The error line for a failed check; '' when the check passed. */
export function errorText(check: DatesCheck, lang: Lang, now: number): string {
  const t = texts(lang);
  if (check === 'ok') return '';
  if (check === 'order') return t.datesErrorOrder;
  const f = makeFormat(lang);
  const { min, max } = allowedDates(now);
  return t.datesErrorSpan(f.dayMonthYear(localMidnight(min)), f.dayMonthYear(localMidnight(max)));
}

/** Where the fixed panel goes: 6 px below the button, clamped into the viewport; full width below 640 px. */
export function panelPosition(btn: { left: number; bottom: number }, panelWidth: number, viewportWidth: number): { top: number; left: number; right: number | null } {
  const top = btn.bottom + 6;
  if (viewportWidth < 640) return { top, left: 16, right: 16 };
  const left = Math.max(16, Math.min(btn.left, viewportWidth - panelWidth - 16));
  return { top, left, right: null };
}

export interface DatesPanelDeps {
  dom: Dom;
  lang: () => Lang;
  now: () => number;
  selection: () => Selection;
  apply: (from: string, to: string) => void;
}

export interface DatesPanel {
  toggle(): void;
  close(): void;
  isOpen(): boolean;
  /** Re-sets the texts that depend on the language (the error line). */
  relabel(): void;
  dispose(): void;
}

export function createDatesPanel(deps: DatesPanelDeps): DatesPanel {
  const { dom } = deps;
  const d = dom.dates;
  const doc = dom.doc;
  const win = doc.defaultView;
  const native = typeof (d.panel as HTMLElement & { showPopover?: unknown }).showPopover === 'function';
  let open = false;
  let lastCheck: DatesCheck = 'ok';
  let closedAt = -Infinity;
  if (native) d.panel.hidden = false;

  const showError = (check: DatesCheck) => {
    lastCheck = check;
    const text = errorText(check, deps.lang(), deps.now());
    d.errorText.textContent = text;
    d.error.hidden = text === '';
  };

  const position = () => {
    const r = d.btn.getBoundingClientRect();
    const p = panelPosition(r, d.panel.offsetWidth || 340, win?.innerWidth ?? 1024);
    d.panel.style.top = `${p.top}px`;
    d.panel.style.left = `${p.left}px`;
    d.panel.style.right = p.right === null ? '' : `${p.right}px`;
  };

  const markClosed = (focusButton: boolean) => {
    if (!open) return;
    open = false;
    closedAt = Date.now();
    d.btn.setAttribute('aria-expanded', 'false');
    if (!native) d.panel.hidden = true;
    if (focusButton) d.btn.focus();
  };

  const show = () => {
    const now = deps.now();
    const { min, max } = allowedDates(now);
    const pre = prefillDates(deps.selection(), now);
    d.from.min = d.to.min = min;
    d.from.max = d.to.max = max;
    d.from.value = pre.from;
    d.to.value = pre.to;
    showError('ok');
    open = true;
    d.btn.setAttribute('aria-expanded', 'true');
    if (native) (d.panel as HTMLElement & { showPopover(): void }).showPopover();
    else d.panel.hidden = false;
    position();
    d.from.focus();
  };

  const close = () => {
    if (!open) return;
    if (native) {
      try {
        (d.panel as HTMLElement & { hidePopover(): void }).hidePopover();
      } catch {
        /* already closed */
      }
    }
    markClosed(true);
  };

  const onSubmit = (e: Event) => {
    e.preventDefault();
    const check = validateDates(d.from.value, d.to.value, deps.now());
    if (check !== 'ok') {
      showError(check);
      return;
    }
    const from = d.from.value;
    const to = d.to.value;
    close();
    deps.apply(from, to);
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && open) {
      e.preventDefault();
      close();
    }
  };
  // Light dismiss done by the browser: only the state and the focus need following.
  const onToggle = (e: Event) => {
    if ((e as Event & { newState?: string }).newState === 'closed') markClosed(true);
  };
  // Without popover support: a click outside the panel and the button closes it.
  const onOutside = (e: Event) => {
    if (!open || native) return;
    const target = e.target as Node | null;
    if (target && (d.panel.contains(target) || d.btn.contains(target))) return;
    markClosed(false);
  };
  const onResize = () => {
    if (open) position();
  };

  d.form.addEventListener('submit', onSubmit);
  d.panel.addEventListener('keydown', onKey);
  d.panel.addEventListener('toggle', onToggle);
  doc.addEventListener('click', onOutside);
  win?.addEventListener('resize', onResize);

  return {
    toggle() {
      if (open) close();
      // The browser closed the panel on the press that led to this click: do not open it again.
      else if (!native || Date.now() - closedAt > 250) show();
    },
    close,
    isOpen: () => open,
    relabel() {
      if (open) showError(lastCheck);
    },
    dispose() {
      d.form.removeEventListener('submit', onSubmit);
      d.panel.removeEventListener('keydown', onKey);
      d.panel.removeEventListener('toggle', onToggle);
      doc.removeEventListener('click', onOutside);
      win?.removeEventListener('resize', onResize);
    },
  };
}
