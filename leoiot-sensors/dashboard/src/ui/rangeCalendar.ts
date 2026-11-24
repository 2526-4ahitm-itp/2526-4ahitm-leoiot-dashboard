// The range calendar inside the date panel: two months side by side (one on a phone), a status line
// that says what to do next, day buttons in two grids. All state and rules come from core/calendar.
// Text is only ever set as text. The structure is rebuilt when the month, the language or the number
// of months changes; picking and hovering only change attributes, so focus stays where it is.
import { calendarNames, clampRightMonth, dayState, monthGrid, monthLimits, monthOf, moveFocus, NO_PICK, pickDay, shiftDayByMonths, shiftMonth, type Allowed, type Move, type Pick } from '../core/calendar';
import { localDate, localMidnight, makeFormat } from '../core/format';
import { texts, type Lang } from '../core/i18n';
import { allowedDates, dayCount } from '../core/ranges';
import { setText } from './render';

export interface RangeCalendarDeps {
  root: HTMLElement;
  status: HTMLElement;
  doc: Document;
  lang: () => Lang;
  now: () => number;
  /** The pick changed: the panel clears its error line. */
  onPick: () => void;
}

export interface RangeCalendar {
  /** Starts with a pick (or none) and shows the month of its last day, else the current month. */
  reset(pick: Pick): void;
  pick(): Pick;
  /** Moves keyboard focus to the day that has the roving tab stop. */
  focusDay(): void;
  /** Redraws the texts after a language change. */
  relabel(): void;
  dispose(): void;
}

/** One month on a phone, two otherwise (the breakpoint of the page's CSS). */
const monthCount = (win: Window | null): number => ((win?.innerWidth ?? 1024) <= 640 ? 1 : 2);

const KEY_MOVES: Record<string, [Move, number]> = {
  ArrowLeft: ['day', -1],
  ArrowRight: ['day', 1],
  ArrowUp: ['week', -1],
  ArrowDown: ['week', 1],
  Home: ['weekStart', 0],
  End: ['weekEnd', 0],
  PageUp: ['month', -1],
  PageDown: ['month', 1],
};

interface Cell {
  td: HTMLElement;
  btn: HTMLButtonElement;
}

export function createRangeCalendar(deps: RangeCalendarDeps): RangeCalendar {
  const { root, doc } = deps;
  const win = doc.defaultView;
  let pick: Pick = NO_PICK;
  let hover: string | null = null;
  let right = '';
  let count = 2;
  let focusDay = '';
  let built = false;
  let cells = new Map<string, Cell>();
  let nav: { prev: HTMLButtonElement | null; next: HTMLButtonElement | null } = { prev: null, next: null };

  const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className?: string): HTMLElementTagNameMap[K] => {
    const e = doc.createElement(tag);
    if (className) e.className = className;
    return e;
  };
  const setAttr = (e: Element, name: string, value: string | null) => {
    if (value === null) e.removeAttribute(name);
    else if (e.getAttribute(name) !== value) e.setAttribute(name, value);
  };

  const allowed = (): Allowed => allowedDates(deps.now());
  const leftMost = () => shiftMonth(right, -(count - 1));

  const arrow = (dir: 'prev' | 'next'): SVGElement => {
    const svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
    for (const [k, v] of Object.entries({ viewBox: '0 0 24 24', width: '16', height: '16', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.8', 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' })) svg.setAttribute(k, v);
    const path = doc.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', dir === 'prev' ? 'M14.5 6 8.5 12l6 6' : 'M9.5 6l6 6-6 6');
    svg.append(path);
    return svg;
  };

  const navButton = (dir: 'prev' | 'next', label: string, disabled: boolean): HTMLButtonElement => {
    const b = el('button', 'cal-nav');
    b.type = 'button';
    b.dataset.nav = dir;
    b.disabled = disabled;
    b.setAttribute('aria-label', label);
    b.append(arrow(dir));
    return b;
  };

  /** Draws the months. Keeps keyboard focus on the same kind of element when it was inside. */
  function build(): void {
    const t = texts(deps.lang());
    const names = calendarNames(deps.lang());
    const span = allowed();
    const { first, last } = monthLimits(span);
    count = monthCount(win);
    right = clampRightMonth(right, count, span);
    // After a resize the tab stop may sit in a month that is no longer shown.
    if (monthOf(focusDay) < leftMost()) focusDay = moveFocus(`${leftMost()}-01`, 'day', 0, span);
    else if (monthOf(focusDay) > right) focusDay = moveFocus(`${right}-28`, 'day', 0, span);
    const active = doc.activeElement as HTMLElement | null;
    const hadFocus = active !== null && root.contains(active);
    const hadNav = hadFocus ? active.dataset.nav ?? null : null;

    cells = new Map();
    const months = el('div', 'cal-months');
    months.dataset.cols = String(count);
    nav = { prev: null, next: null };
    for (let i = 0; i < count; i++) {
      const month = shiftMonth(right, i - (count - 1));
      const [y, m] = month.split('-').map(Number);
      const block = el('div', 'cal-month');
      const head = el('div', 'cal-month-head');
      const title = el('p', 'cal-title');
      title.id = `datesCalTitle${i}`;
      title.textContent = names.month(month);
      if (i === 0) head.append((nav.prev = navButton('prev', t.calPrev, leftMost() <= first)));
      else head.append(el('span'));
      head.append(title);
      if (i === count - 1) head.append((nav.next = navButton('next', t.calNext, right >= last)));
      else head.append(el('span'));

      const table = el('table', 'cal-grid');
      table.setAttribute('role', 'grid');
      table.setAttribute('aria-labelledby', title.id);
      const headRow = el('tr');
      t.calWeekdays.forEach((w) => {
        const th = el('th');
        th.scope = 'col';
        th.textContent = w;
        headRow.append(th);
      });
      const thead = el('thead');
      thead.append(headRow);
      table.append(thead);
      const body = el('tbody');
      for (const week of monthGrid(y, m)) {
        const tr = el('tr');
        for (const day of week) {
          const td = el('td', 'cal-day');
          if (day !== null) {
            const btn = el('button');
            btn.type = 'button';
            btn.dataset.date = day;
            btn.textContent = String(Number(day.slice(8)));
            btn.setAttribute('aria-label', names.day(day));
            td.append(btn);
            cells.set(day, { td, btn });
          }
          tr.append(td);
        }
        body.append(tr);
      }
      table.append(body);
      block.append(head, table);
      months.append(block);
    }
    root.replaceChildren(months);
    built = true;
    paint();
    if (hadFocus) {
      const wanted = hadNav ? nav[hadNav as 'prev' | 'next'] : null;
      if (wanted && !wanted.disabled) wanted.focus();
      else cells.get(focusDay)?.btn.focus();
    }
  }

  /** The state of every day button and the status line. */
  function paint(): void {
    const span = allowed();
    const today = localDate(deps.now());
    for (const [day, { td, btn }] of cells) {
      const s = dayState(day, pick, hover, span, today);
      setAttr(td, 'data-role', s.role === 'none' ? null : s.role);
      setAttr(td, 'data-preview', s.preview ? 'true' : null);
      setAttr(td, 'data-today', s.today ? 'true' : null);
      setAttr(btn, 'aria-pressed', day === pick.from || day === pick.to ? 'true' : null);
      setAttr(btn, 'aria-disabled', s.disabled ? 'true' : null);
      setAttr(btn, 'tabindex', day === focusDay && !s.disabled ? '0' : '-1');
    }
    status();
  }

  function dayLabel(day: string): string {
    const f = makeFormat(deps.lang());
    const ms = localMidnight(day);
    return day.slice(0, 4) === localDate(deps.now()).slice(0, 4) ? f.dayMonth(ms) : f.dayMonthYear(ms);
  }

  function status(): void {
    const t = texts(deps.lang());
    const { from, to } = pick;
    setText(deps.status, from === null ? t.calPickFirst : to === null ? t.calPickLast(dayLabel(from)) : t.calRange(dayLabel(from), dayLabel(to), dayCount(from, to)));
  }

  /** Pages so that the day is shown; true when the months changed. */
  function reveal(day: string): boolean {
    const month = monthOf(day);
    const before = right;
    if (month < leftMost()) right = shiftMonth(month, count - 1);
    else if (month > right) right = month;
    right = clampRightMonth(right, count, allowed());
    return right !== before;
  }

  function page(by: number): void {
    const before = right;
    right = clampRightMonth(shiftMonth(right, by), count, allowed());
    if (right === before) return;
    // The roving tab stop must stay on a shown day: carry it along by whole months.
    if (monthOf(focusDay) < leftMost() || monthOf(focusDay) > right) focusDay = moveFocus(shiftDayByMonths(focusDay, by), 'day', 0, allowed());
    build();
  }

  function choose(day: string): void {
    pick = pickDay(pick, day);
    focusDay = day;
    paint();
    deps.onPick();
  }

  const onClick = (e: Event) => {
    const target = (e.target as Element | null)?.closest<HTMLButtonElement>('button');
    if (!target || !root.contains(target)) return;
    if (target.dataset.nav) {
      page(target.dataset.nav === 'prev' ? -1 : 1);
    } else if (target.dataset.date && target.getAttribute('aria-disabled') !== 'true') {
      choose(target.dataset.date);
    }
  };
  const onOver = (e: Event) => {
    const day = (e.target as Element | null)?.closest<HTMLButtonElement>('button')?.dataset.date ?? null;
    if (day === hover || day === null) return;
    hover = day;
    if (pick.from !== null && pick.to === null) paint();
  };
  const onLeave = () => {
    if (hover === null) return;
    hover = null;
    if (pick.from !== null && pick.to === null) paint();
  };
  const onKey = (e: KeyboardEvent) => {
    const target = (e.target as Element | null)?.closest<HTMLButtonElement>('button[data-date]');
    if (!target || e.altKey) return;
    const day = target.dataset.date as string;
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) return; // the panel shows the range
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
      e.preventDefault();
      if (target.getAttribute('aria-disabled') !== 'true') choose(day);
      return;
    }
    const move = KEY_MOVES[e.key];
    if (!move || e.ctrlKey || e.metaKey) return;
    e.preventDefault();
    const [kind, n] = move;
    const next = moveFocus(day, e.shiftKey && kind === 'month' ? 'year' : kind, n, allowed());
    hover = null;
    focusDay = next;
    if (reveal(next)) build();
    else paint();
    cells.get(next)?.btn.focus();
  };
  const onResize = () => {
    if (built && monthCount(win) !== count) build();
  };

  root.addEventListener('click', onClick);
  root.addEventListener('mouseover', onOver);
  root.addEventListener('mouseleave', onLeave);
  root.addEventListener('keydown', onKey);
  win?.addEventListener('resize', onResize);

  return {
    reset(initial) {
      const span = allowed();
      pick = { ...initial };
      hover = null;
      const start = pick.to ?? pick.from ?? span.max;
      focusDay = moveFocus(start, 'day', 0, span);
      right = monthOf(pick.to ?? span.max);
      build();
    },
    pick: () => ({ ...pick }),
    focusDay() {
      cells.get(focusDay)?.btn.focus();
    },
    relabel() {
      if (built) build();
    },
    dispose() {
      root.removeEventListener('click', onClick);
      root.removeEventListener('mouseover', onOver);
      root.removeEventListener('mouseleave', onLeave);
      root.removeEventListener('keydown', onKey);
      win?.removeEventListener('resize', onResize);
    },
  };
}
