// Datumsauswahl als Popover unter dem Zeitraumtitel: Tag/Woche = Monatskalender, Monat = Monatsraster, Jahr = Jahresraster.
import { dayDisabled, monthDisabled, monthGrid, monthMatrix, moveCell, shiftMonth, yearList, type PickerMode } from '../core/calendar';
import { dateLong, monthName, TEXT, weekdayByIndex, type Lang } from '../core/i18n';
import { periodStart, type Route, type View } from '../core/route';
import { el } from './dom';

export interface PickerState {
  view: View;
  key: string; // erster Tag des gezeigten Zeitraums
  lang: Lang;
  min: string | null;
  max: string;
  today: string;
}

export interface DatePicker {
  update(s: PickerState): void;
  close(): void;
}

const pad = (n: number, w = 2): string => String(n).padStart(w, '0');

export function createDatePicker(host: HTMLElement, trigger: HTMLButtonElement, onPick: (r: Route) => void): DatePicker {
  const panel = el('div', { class: 'picker', role: 'dialog', hidden: '' });
  host.append(panel);
  let s: PickerState | null = null;
  let isOpen = false;
  let cursor = '';

  const mode = (): PickerMode => (s!.view === 'year' ? 'year' : s!.view === 'month' ? 'month' : 'day');
  panel.dataset.mode = 'day';

  function selected(key: string): boolean {
    const cur = s!;
    switch (cur.view) {
      case 'day':
        return key === cur.key;
      case 'week':
        return periodStart('week', key) === cur.key;
      case 'month':
        return key.slice(0, 7) === cur.key.slice(0, 7);
      case 'year':
        return key.slice(0, 4) === cur.key.slice(0, 4);
    }
  }

  function cell(tag: 'td' | 'div', key: string, text: string, label: string, disabled: boolean, extra: string): HTMLElement {
    const c = el(tag, {
      role: 'gridcell',
      'data-key': key,
      'aria-label': label,
      'aria-selected': String(selected(key)),
      tabindex: key === cursor ? '0' : '-1',
      class: 'pc' + extra + (disabled ? ' off' : ''),
    }, text);
    if (disabled) {
      c.setAttribute('aria-disabled', 'true');
      c.tabIndex = -1;
    }
    if (selected(key)) c.classList.add('sel');
    return c;
  }

  function navButton(dir: 'prev' | 'next', label: string, disabled: boolean): HTMLButtonElement {
    const b = el('button', { type: 'button', class: 'pnav', 'data-nav': dir, 'aria-label': label }, dir === 'prev' ? '‹' : '›');
    b.disabled = disabled;
    return b;
  }

  function render(focus: 'cell' | 'prev' | 'next' | null): void {
    if (!s) return;
    const L = TEXT[s.lang];
    const m = mode();
    panel.dataset.mode = s.view;
    panel.setAttribute('aria-label', L.chooseDate);
    const y = Number(cursor.slice(0, 4));
    const mo = Number(cursor.slice(5, 7));
    let head: HTMLElement;
    let body: HTMLElement;
    if (m === 'day') {
      const prevOff = monthDisabled(shiftMonth(`${pad(y, 4)}-${pad(mo)}-01`, -1), s.min, s.max);
      const nextOff = monthDisabled(shiftMonth(`${pad(y, 4)}-${pad(mo)}-01`, 1), s.min, s.max);
      head = el('div', { class: 'phead' }, navButton('prev', L.prevMonth, prevOff), el('div', { class: 'ptitle2', 'aria-live': 'polite' }, `${monthName(mo, s.lang)} ${y}`), navButton('next', L.nextMonth, nextOff));
      const rows = monthMatrix(y, mo, s.min, s.max);
      const hr = el('tr', {}, el('th', { scope: 'col', class: 'wk', abbr: L.week }, L.weekShort), ...Array.from({ length: 7 }, (_, i) => el('th', { scope: 'col' }, weekdayByIndex(i, s!.lang))));
      const trs = rows.map((w) =>
        el(
          'tr',
          { class: w.days.some((d) => selected(d.key)) && s!.view === 'week' ? 'selrow' : '' },
          el('th', { scope: 'row', class: 'wk' }, String(w.week)),
          ...w.days.map((d) =>
            cell('td', d.key, String(d.day), dateLong(d.key, s!.lang), d.disabled, (d.inMonth ? '' : ' out') + (d.key === s!.today ? ' today' : '')),
          ),
        ),
      );
      body = el('table', { role: 'grid', class: 'pgrid', 'aria-label': `${monthName(mo, s.lang)} ${y}` }, el('thead', {}, hr), el('tbody', {}, ...trs));
    } else if (m === 'month') {
      head = el('div', { class: 'phead' }, navButton('prev', L.prevYear, y <= Number((s.min ?? s.max).slice(0, 4))), el('div', { class: 'ptitle2', 'aria-live': 'polite' }, String(y)), navButton('next', L.nextYear, y >= Number(s.max.slice(0, 4))));
      const cells = monthGrid(y, s.min, s.max).map((c) =>
        cell('div', c.key, monthName(c.month, s!.lang).slice(0, s!.lang === 'de' ? 4 : 3), `${monthName(c.month, s!.lang)} ${y}`, c.disabled, c.key.slice(0, 7) === s!.today.slice(0, 7) ? ' today' : ''),
      );
      body = el('div', { role: 'grid', class: 'pbig', 'aria-label': String(y) }, ...[0, 1, 2, 3].map((r) => el('div', { role: 'row', class: 'prow' }, ...cells.slice(r * 3, r * 3 + 3))));
    } else {
      head = el('div', { class: 'phead' }, el('div', { class: 'ptitle2' }, L.years));
      const years = yearList(s.min, s.max);
      const cells = years.map((yy) => cell('div', `${pad(yy, 4)}-01-01`, String(yy), String(yy), false, yy === Number(s!.today.slice(0, 4)) ? ' today' : ''));
      const rows: HTMLElement[] = [];
      for (let i = 0; i < cells.length; i += 3) rows.push(el('div', { role: 'row', class: 'prow' }, ...cells.slice(i, i + 3)));
      body = el('div', { role: 'grid', class: 'pbig', 'aria-label': L.years }, ...rows);
    }
    panel.replaceChildren(head, body);
    if (focus === 'cell') panel.querySelector<HTMLElement>(`[data-key="${cursor}"]`)?.focus();
    else if (focus) {
      const b = panel.querySelector<HTMLButtonElement>(`[data-nav="${focus}"]`);
      if (b && !b.disabled) b.focus();
      else panel.querySelector<HTMLElement>(`[data-key="${cursor}"]`)?.focus();
    }
  }

  function place(): void {
    if (window.matchMedia('(max-width: 520px)').matches) {
      panel.style.left = '';
      return;
    }
    panel.style.left = trigger.offsetLeft + 'px';
    const over = panel.getBoundingClientRect().right - (window.innerWidth - 8);
    if (over > 0) panel.style.left = Math.max(0, trigger.offsetLeft - over) + 'px';
  }

  const outside = (e: PointerEvent): void => {
    const t = e.target as Node;
    if (!panel.contains(t) && !trigger.contains(t)) close(false);
  };

  function open(): void {
    if (!s || isOpen) return;
    isOpen = true;
    cursor = dayDisabled(s.key, s.min, s.max) ? (s.min ?? s.key) : s.key;
    if (s.view === 'month') cursor = s.key.slice(0, 7) + '-01';
    if (s.view === 'year') cursor = s.key.slice(0, 4) + '-01-01';
    panel.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
    document.addEventListener('pointerdown', outside, true);
    render('cell');
    place();
  }

  function close(returnFocus: boolean): void {
    if (!isOpen) return;
    isOpen = false;
    panel.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    document.removeEventListener('pointerdown', outside, true);
    if (returnFocus) trigger.focus();
  }

  function pick(key: string): void {
    if (!s) return;
    const view = s.view;
    close(true);
    onPick({ view, key: periodStart(view, key) });
  }

  trigger.addEventListener('click', () => (isOpen ? close(true) : open()));

  panel.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    const nav = t.closest<HTMLButtonElement>('button[data-nav]');
    if (nav && s) {
      const step = nav.dataset.nav === 'next' ? 1 : -1;
      const n = mode() === 'day' ? step : step * 12;
      const moved = shiftMonth(cursor, n);
      cursor = mode() === 'day' ? moved : moved.slice(0, 7) + '-01';
      render(nav.dataset.nav as 'prev' | 'next');
      return;
    }
    const c = t.closest<HTMLElement>('[data-key]');
    if (c && c.getAttribute('aria-disabled') !== 'true') pick(c.dataset.key!);
  });

  panel.addEventListener('keydown', (e) => {
    if (!s) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close(true);
      return;
    }
    if (e.key === 'Tab') {
      const items = [...panel.querySelectorAll<HTMLElement>('button:not(:disabled), [role="gridcell"][tabindex="0"]')];
      if (items.length === 0) return;
      const i = items.indexOf(document.activeElement as HTMLElement);
      const next = e.shiftKey ? (i <= 0 ? items.length - 1 : i - 1) : i === items.length - 1 ? 0 : i + 1;
      e.preventDefault();
      items[next].focus();
      return;
    }
    const target = (e.target as HTMLElement).closest<HTMLElement>('[role="gridcell"]');
    if (!target) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (target.getAttribute('aria-disabled') !== 'true') pick(target.dataset.key!);
      return;
    }
    const first = yearList(s.min, s.max)[0];
    const next = moveCell(mode(), cursor, e.key, s.min, s.max, first);
    if (next === null) return;
    e.preventDefault();
    cursor = next;
    render('cell');
  });

  return {
    update(next) {
      const changed = JSON.stringify(next) !== JSON.stringify(s);
      s = next;
      if (isOpen && changed) render(panel.contains(document.activeElement) ? 'cell' : null);
    },
    close: () => close(false),
  };
}
