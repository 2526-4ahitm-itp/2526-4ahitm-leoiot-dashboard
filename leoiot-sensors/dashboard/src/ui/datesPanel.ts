// The panel under the date segment: the range calendar, the "no day picked" error and apply. It uses
// the browser's popover when there is one and a plain hidden/shown panel with its own Escape and
// outside-click handling otherwise. The pure helpers are exported for tests.
import { NO_PICK, type Pick } from '../core/calendar';
import { texts, type Lang } from '../core/i18n';
import { validateDates, type Selection } from '../core/ranges';
import type { Dom } from './render';
import { createRangeCalendar } from './rangeCalendar';

/** The pick the calendar starts with: the shown dates, else nothing (the calendar then shows the current month). */
export function prefillDates(sel: Selection): Pick {
  return sel.kind === 'dates' ? { from: sel.from, to: sel.to } : NO_PICK;
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
  /** Re-sets the texts that depend on the language (calendar, error line). */
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
  let errorShown = false;
  let closedAt = -Infinity;
  if (native) d.panel.hidden = false;

  const calendar = createRangeCalendar({
    root: d.cal,
    status: d.status,
    doc,
    lang: deps.lang,
    now: deps.now,
    onPick: () => showError(false),
  });

  function showError(on: boolean) {
    errorShown = on;
    d.errorText.textContent = on ? texts(deps.lang()).datesErrorNone : '';
    d.error.hidden = !on;
  }

  const position = () => {
    const r = d.btn.getBoundingClientRect();
    const p = panelPosition(r, d.panel.offsetWidth || 568, win?.innerWidth ?? 1024);
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
    calendar.reset(prefillDates(deps.selection()));
    showError(false);
    open = true;
    d.btn.setAttribute('aria-expanded', 'true');
    if (native) (d.panel as HTMLElement & { showPopover(): void }).showPopover();
    else d.panel.hidden = false;
    position();
    calendar.focusDay();
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

  /** Shows the picked range; one picked day is a range of that day. */
  function submit() {
    const { from, to } = calendar.pick();
    // The calendar cannot produce a bad range; the check stays as a guard.
    if (from === null || validateDates(from, to ?? from, deps.now()) !== 'ok') {
      showError(true);
      return;
    }
    close();
    deps.apply(from, to ?? from);
  }
  const onSubmit = (e: Event) => {
    e.preventDefault();
    submit();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && open) {
      e.preventDefault();
      close();
    } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && open) {
      e.preventDefault();
      submit();
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
      if (!open) return;
      calendar.relabel();
      showError(errorShown);
    },
    dispose() {
      calendar.dispose();
      d.form.removeEventListener('submit', onSubmit);
      d.panel.removeEventListener('keydown', onKey);
      d.panel.removeEventListener('toggle', onToggle);
      doc.removeEventListener('click', onOutside);
      win?.removeEventListener('resize', onResize);
    },
  };
}
