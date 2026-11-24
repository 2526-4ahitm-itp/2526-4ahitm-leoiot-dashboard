// @vitest-environment happy-dom
// The date segment, the range calendar in its panel and the selection in the page
// (sensors-history-date-range 2.1 to 2.3, sensors-range-calendar-room-filter 1.2 and 1.3).
/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterEach, describe, expect, it } from 'vitest';
import { panelPosition, prefillDates } from '../src/ui/datesPanel';
import { disposeApps, fakeEcharts, startTestApp } from './harness';
import { flush } from './helpers';

afterEach(disposeApps);
// Test "now": Tue 3 Nov 2026, 07:36:30 Vienna. Allowed days: 2025-10-03 to 2026-11-03.

type T = Awaited<ReturnType<typeof startTestApp>>;
const day = (d: string) => document.querySelector<HTMLButtonElement>(`#datesCal button[data-date="${d}"]`)!;
const cell = (d: string) => day(d).closest('td')!;
const clickDay = async (d: string) => {
  day(d).click();
  await flush();
};
const key = (el: Element, k: string, init: KeyboardEventInit = {}) => el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init }));
const focused = () => (document.activeElement as HTMLElement | null)?.dataset.date ?? null;
const titles = () => [...document.querySelectorAll('#datesCal .cal-title')].map((e) => e.textContent);
const status = () => document.getElementById('datesStatus')!.textContent;
async function show(t: T) {
  t.$('datesForm').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  await flush();
}
/** Opens the panel, picks two days with the mouse and shows the range. */
async function pick(t: T, from: string, to: string) {
  await t.click('#datesBtn');
  await openMonthOf(t, from);
  await clickDay(from);
  await openMonthOf(t, to);
  await clickDay(to);
  await show(t);
}
/** Pages until the day is shown. */
async function openMonthOf(t: T, d: string) {
  for (let i = 0; i < 20 && !document.querySelector(`#datesCal button[data-date="${d}"]`); i++) {
    const firstShown = document.querySelector<HTMLElement>('#datesCal button[data-date]')!.dataset.date!;
    await t.click(`.cal-nav[data-nav="${d < firstShown ? 'prev' : 'next'}"]`);
  }
}
const escape = () => document.getElementById('datesPanel')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

describe('panel helpers', () => {
  it('prefill: the shown dates, else nothing', () => {
    expect(prefillDates({ kind: '24h' })).toEqual({ from: null, to: null });
    expect(prefillDates({ kind: '7d' })).toEqual({ from: null, to: null });
    expect(prefillDates({ kind: 'dates', from: '2026-10-01', to: '2026-10-02' })).toEqual({ from: '2026-10-01', to: '2026-10-02' });
  });
  it('position: below the button, clamped, full width on a phone', () => {
    expect(panelPosition({ left: 300, bottom: 50 }, 568, 1280)).toEqual({ top: 56, left: 300, right: null });
    expect(panelPosition({ left: 1200, bottom: 50 }, 568, 1280)).toEqual({ top: 56, left: 696, right: null });
    expect(panelPosition({ left: 2, bottom: 50 }, 568, 1280).left).toBe(16);
    expect(panelPosition({ left: 100, bottom: 90 }, 568, 375)).toEqual({ top: 96, left: 16, right: 16 });
  });
});

describe('the date segment', () => {
  it('not selected: icon only, named "Zeitraum wählen", panel closed', async () => {
    const t = await startTestApp();
    const b = t.$('datesBtn');
    expect(t.$('datesText').textContent).toBe('');
    expect(t.$('datesText').hidden).toBe(true);
    expect(b.querySelector('svg')).not.toBeNull();
    expect([b.getAttribute('aria-pressed'), b.getAttribute('aria-expanded'), b.getAttribute('aria-controls')]).toEqual(['false', 'false', 'datesPanel']);
    expect(b.getAttribute('aria-label')).toBe('Zeitraum wählen');
    expect(b.getAttribute('title')).toBe('Zeitraum wählen');
    expect(t.$('datesPanel').hidden).toBe(true);
    expect(t.$('datesPanel').getAttribute('aria-label')).toBe('Zeitraum wählen');
    await t.click('[data-lang="en"]');
    expect(t.$('datesText').textContent).toBe('');
    expect(b.getAttribute('aria-label')).toBe('Pick dates');
    expect(b.getAttribute('title')).toBe('Pick dates');
    expect(t.$('datesSubmit').textContent).toBe('Show');
  });
  it('selected: pressed, icon and dates, accessible name with the full range; 24 h and 7 Tage released', async () => {
    const t = await startTestApp();
    await pick(t, '2026-10-12', '2026-10-16');
    const b = t.$('datesBtn');
    expect(t.$('datesText').hidden).toBe(false);
    expect(t.$('datesText').textContent).toBe('12.10. – 16.10.');
    expect(b.querySelector('svg')).not.toBeNull();
    expect([b.getAttribute('aria-pressed'), b.getAttribute('aria-expanded')]).toEqual(['true', 'false']);
    expect(b.getAttribute('aria-label')).toBe('Zeitraum: 12.10.2026 – 16.10.2026');
    expect(b.getAttribute('title')).toBe('Zeitraum: 12.10.2026 – 16.10.2026');
    expect(['24h', '7d'].map((r) => t.$('rangeGroup').querySelector(`[data-range="${r}"]`)!.getAttribute('aria-pressed'))).toEqual(['false', 'false']);
    await t.click('[data-lang="en"]');
    expect(t.$('datesText').textContent).toBe('12 Oct – 16 Oct');
    expect(b.getAttribute('aria-label')).toBe('Dates: 12 Oct 2026 – 16 Oct 2026');
  });
  it('one day and another year', async () => {
    const t = await startTestApp();
    await pick(t, '2026-10-13', '2026-10-13');
    expect(t.$('datesText').textContent).toBe('Di 13.10.');
    await pick(t, '2025-11-17', '2025-11-20');
    expect(t.$('datesText').textContent).toBe('17.11.2025 – 20.11.2025');
  });
  it('back to 24 h: icon only again', async () => {
    const t = await startTestApp();
    await pick(t, '2026-10-12', '2026-10-16');
    await t.click('[data-range="24h"]');
    expect(t.$('datesText').hidden).toBe(true);
    expect(t.$('datesBtn').getAttribute('aria-label')).toBe('Zeitraum wählen');
  });
});

describe('the range calendar', () => {
  it('opens on the current month with nothing picked, two months, focus on today', async () => {
    const t = await startTestApp();
    await t.click('#datesBtn');
    expect(t.$('datesPanel').hidden).toBe(false);
    expect(t.$('datesBtn').getAttribute('aria-expanded')).toBe('true');
    expect(titles()).toEqual(['Oktober 2026', 'November 2026']);
    expect(status()).toBe('Ersten Tag wählen');
    expect(document.querySelectorAll('#datesCal [data-role]')).toHaveLength(0);
    expect(focused()).toBe('2026-11-03');
    expect(day('2026-11-03').getAttribute('tabindex')).toBe('0');
    expect(day('2026-11-02').getAttribute('tabindex')).toBe('-1');
    expect(cell('2026-11-03').dataset.today).toBe('true');
    expect(t.$('datesError').hidden).toBe(true);
  });
  it('structure: grids, weekday header starting on Monday, full-date labels', async () => {
    const t = await startTestApp();
    await t.click('#datesBtn');
    const grids = document.querySelectorAll('#datesCal table[role="grid"]');
    expect(grids).toHaveLength(2);
    expect([...grids[1].querySelectorAll('thead th')].map((th) => th.textContent)).toEqual(['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']);
    expect(grids[1].getAttribute('aria-labelledby')).toBe(document.querySelectorAll('#datesCal .cal-title')[1].id);
    // 1 November 2026 is a Sunday: the first row has six empty cells before it
    expect([...grids[1].querySelector('tbody tr')!.children].map((td) => td.children.length)).toEqual([0, 0, 0, 0, 0, 0, 1]);
    expect(day('2026-11-16').getAttribute('aria-label')).toBe('Montag, 16. November 2026');
    expect(day('2026-11-16').textContent).toBe('16');
    expect(document.getElementById('datesStatus')!.getAttribute('aria-live')).toBe('polite');
  });
  it('English: weekday header, labels and status', async () => {
    const t = await startTestApp();
    await t.click('[data-lang="en"]');
    await t.click('#datesBtn');
    expect(titles()).toEqual(['October 2026', 'November 2026']);
    expect([...document.querySelectorAll('#datesCal thead th')].slice(0, 7).map((th) => th.textContent)).toEqual(['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']);
    expect(status()).toBe('Pick the first day');
    await clickDay('2026-10-12');
    expect(status()).toBe('12 Oct picked – pick the last day');
    await clickDay('2026-10-16');
    expect(status()).toBe('12 Oct – 16 Oct · 5 days');
    expect(day('2026-11-16').getAttribute('aria-label')).toMatch(/^Monday,? 16 November 2026$/);
  });
  it('switching the language while open redraws the calendar', async () => {
    const t = await startTestApp();
    await t.click('#datesBtn');
    await clickDay('2026-10-12');
    await t.click('[data-lang="en"]');
    expect(titles()).toEqual(['October 2026', 'November 2026']);
    expect(status()).toBe('12 Oct picked – pick the last day');
    expect(day('2026-10-12').getAttribute('aria-pressed')).toBe('true');
  });
  it('first click, second click: the status line follows, the range is marked', async () => {
    const t = await startTestApp();
    await t.click('#datesBtn');
    await clickDay('2026-10-12');
    expect(status()).toBe('12.10. gewählt – letzten Tag wählen');
    expect(cell('2026-10-12').dataset.role).toBe('single');
    await clickDay('2026-10-16');
    expect(status()).toBe('12.10. – 16.10. · 5 Tage');
    expect(['2026-10-12', '2026-10-13', '2026-10-15', '2026-10-16', '2026-10-17'].map((d) => cell(d).dataset.role)).toEqual(['start', 'inside', 'inside', 'end', undefined]);
    expect(['2026-10-12', '2026-10-14', '2026-10-16'].map((d) => day(d).getAttribute('aria-pressed'))).toEqual(['true', null, 'true']);
  });
  it('a range across both months is marked in both', async () => {
    const t = await startTestApp();
    await t.click('#datesBtn');
    await clickDay('2026-10-30');
    await clickDay('2026-11-02');
    expect(['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02'].map((d) => cell(d).dataset.role)).toEqual(['start', 'inside', 'inside', 'end']);
    expect(status()).toBe('30.10. – 2.11. · 4 Tage');
  });
  it('hovering previews the range while only the first day is picked', async () => {
    const t = await startTestApp();
    await t.click('#datesBtn');
    await clickDay('2026-10-12');
    day('2026-10-15').dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    expect(['2026-10-13', '2026-10-14'].map((d) => [cell(d).dataset.role, cell(d).dataset.preview])).toEqual([['inside', 'true'], ['inside', 'true']]);
    expect(cell('2026-10-15').dataset.role).toBe('end');
    expect(status()).toBe('12.10. gewählt – letzten Tag wählen'); // the status describes the pick, not the preview
    document.getElementById('datesCal')!.dispatchEvent(new MouseEvent('mouseleave'));
    expect(cell('2026-10-14').dataset.role).toBeUndefined();
    await clickDay('2026-10-15');
    day('2026-10-20').dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    expect(cell('2026-10-18').dataset.preview).toBeUndefined(); // no preview once the range is complete
  });
  it('an earlier day starts a new range, no error; a click after a complete range starts again', async () => {
    const t = await startTestApp();
    await t.click('#datesBtn');
    await clickDay('2026-10-20');
    await clickDay('2026-10-17');
    expect(t.$('datesError').hidden).toBe(true);
    expect(status()).toBe('17.10. gewählt – letzten Tag wählen');
    expect(cell('2026-10-20').dataset.role).toBeUndefined();
    await clickDay('2026-10-19');
    await clickDay('2026-10-25');
    expect(status()).toBe('25.10. gewählt – letzten Tag wählen');
    expect(cell('2026-10-19').dataset.role).toBeUndefined();
  });
  it('one day: picked once, or twice, shows that day', async () => {
    const t = await startTestApp();
    await t.click('#datesBtn');
    await clickDay('2026-10-13');
    await show(t);
    expect(t.$('datesPanel').hidden).toBe(true);
    expect(t.$('datesText').textContent).toBe('Di 13.10.');
    expect(t.$('winCo2').textContent).toBe('Di 13.10.2026 · ppm');
    await t.click('#datesBtn');
    expect(status()).toBe('13.10. · 1 Tag');
    await clickDay('2026-10-14');
    await clickDay('2026-10-14');
    expect(status()).toBe('14.10. · 1 Tag');
    await show(t);
    expect(t.$('datesText').textContent).toBe('Mi 14.10.');
  });
  it('showing with nothing picked: the error line, the panel stays, nothing changes; picking clears it', async () => {
    const t = await startTestApp();
    const before = t.historyQueries().length;
    await t.click('#datesBtn');
    await show(t);
    expect(t.$('datesError').hidden).toBe(false);
    expect(t.$('datesErrorText').textContent).toBe('Bitte einen Tag wählen.');
    expect(t.$('datesError').querySelector('svg')).not.toBeNull();
    expect(t.$('datesPanel').hidden).toBe(false);
    expect(t.$('datesBtn').getAttribute('aria-pressed')).toBe('false');
    expect(t.historyQueries().length).toBe(before);
    await t.click('[data-lang="en"]');
    expect(t.$('datesErrorText').textContent).toBe('Please pick a day.');
    await clickDay('2026-10-13');
    expect(t.$('datesError').hidden).toBe(true);
  });
  it('days outside the span are marked, not pickable, and ignored by clicks', async () => {
    const t = await startTestApp();
    await t.click('#datesBtn');
    expect(day('2026-11-04').getAttribute('aria-disabled')).toBe('true');
    expect(day('2026-11-03').hasAttribute('aria-disabled')).toBe(false);
    await clickDay('2026-11-04');
    expect(status()).toBe('Ersten Tag wählen');
    expect(cell('2026-11-04').dataset.role).toBeUndefined();
    await openMonthOf(t, '2025-10-03');
    expect(day('2025-10-02').getAttribute('aria-disabled')).toBe('true');
    expect(day('2025-10-03').hasAttribute('aria-disabled')).toBe(false);
    await clickDay('2025-10-02');
    expect(status()).toBe('Ersten Tag wählen');
  });
  it('paging: next is disabled at the current month, previous at the first allowed month', async () => {
    const t = await startTestApp();
    await t.click('#datesBtn');
    const prev = () => document.querySelector<HTMLButtonElement>('.cal-nav[data-nav="prev"]')!;
    const next = () => document.querySelector<HTMLButtonElement>('.cal-nav[data-nav="next"]')!;
    expect([prev().disabled, next().disabled]).toEqual([false, true]);
    expect([prev().getAttribute('aria-label'), next().getAttribute('aria-label')]).toEqual(['Vorheriger Monat', 'Nächster Monat']);
    await t.click('.cal-nav[data-nav="prev"]');
    expect(titles()).toEqual(['September 2026', 'Oktober 2026']);
    expect(next().disabled).toBe(false);
    for (let i = 0; i < 20; i++) if (!prev().disabled) await t.click('.cal-nav[data-nav="prev"]');
    expect(titles()).toEqual(['Oktober 2025', 'November 2025']);
    expect(prev().disabled).toBe(true);
    await t.click('.cal-nav[data-nav="next"]');
    expect(titles()).toEqual(['November 2025', 'Dezember 2025']);
    expect(prev().disabled).toBe(false);
  });
  it('paging keeps the pick', async () => {
    const t = await startTestApp();
    await t.click('#datesBtn');
    await clickDay('2026-10-12');
    await t.click('.cal-nav[data-nav="prev"]');
    await clickDay('2026-09-20');
    expect(status()).toBe('20.9. gewählt – letzten Tag wählen');
    await t.click('.cal-nav[data-nav="next"]');
    expect(cell('2026-10-12').dataset.role).toBeUndefined();
    await clickDay('2026-10-14');
    await show(t);
    expect(t.$('datesText').textContent).toBe('20.9. – 14.10.');
  });
  it('reopening shows the shown dates, picked, with their month on the right', async () => {
    const t = await startTestApp();
    await pick(t, '2026-09-12', '2026-09-16');
    await t.click('#datesBtn');
    expect(titles()).toEqual(['August 2026', 'September 2026']);
    expect(status()).toBe('12.9. – 16.9. · 5 Tage');
    expect(cell('2026-09-14').dataset.role).toBe('inside');
    expect(focused()).toBe('2026-09-16');
  });
  it('a range from last year names its years in the status', async () => {
    const t = await startTestApp();
    await pick(t, '2025-11-17', '2025-11-20');
    await t.click('#datesBtn');
    expect(status()).toBe('17.11.2025 – 20.11.2025 · 4 Tage');
  });
  it('a phone shows one month', async () => {
    const t = await startTestApp();
    const w = window as unknown as { innerWidth: number; dispatchEvent(e: Event): boolean };
    const before = w.innerWidth;
    w.innerWidth = 500;
    try {
      await t.click('#datesBtn');
      expect(titles()).toEqual(['November 2026']);
      expect(document.querySelectorAll('#datesCal .cal-nav')).toHaveLength(2);
      await t.click('.cal-nav[data-nav="prev"]');
      expect(titles()).toEqual(['Oktober 2026']);
      w.innerWidth = before;
      w.dispatchEvent(new Event('resize'));
      expect(titles()).toEqual(['September 2026', 'Oktober 2026']);
    } finally {
      w.innerWidth = before;
    }
  });
});

describe('the range calendar with the keyboard', () => {
  it('arrows move by day and week, Enter picks, the status announces it', async () => {
    const t = await startTestApp();
    await t.click('#datesBtn');
    expect(focused()).toBe('2026-11-03');
    key(day('2026-11-03'), 'ArrowLeft');
    expect(focused()).toBe('2026-11-02');
    key(day('2026-11-02'), 'ArrowUp');
    expect(focused()).toBe('2026-10-26');
    key(day('2026-10-26'), 'ArrowRight');
    key(day('2026-10-27'), 'ArrowDown');
    expect(focused()).toBe('2026-11-03');
    key(day('2026-11-03'), 'ArrowLeft', {});
    key(day('2026-11-02'), 'Enter');
    expect(status()).toBe('2.11. gewählt – letzten Tag wählen');
    expect(day('2026-11-02').getAttribute('aria-pressed')).toBe('true');
    key(day('2026-11-02'), 'ArrowRight');
    key(day('2026-11-03'), ' ');
    expect(status()).toBe('2.11. – 3.11. · 2 Tage');
  });
  it('Enter on a day does not submit the form', async () => {
    const t = await startTestApp();
    await t.click('#datesBtn');
    const e = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    day('2026-11-03').dispatchEvent(e);
    expect(e.defaultPrevented).toBe(true);
    expect(t.$('datesPanel').hidden).toBe(false);
  });
  it('Home and End go to the start and end of the week, kept inside the allowed days', async () => {
    const t = await startTestApp();
    await t.click('#datesBtn');
    key(day('2026-11-03'), 'Home');
    expect(focused()).toBe('2026-11-02');
    key(day('2026-11-02'), 'End');
    expect(focused()).toBe('2026-11-03'); // Sunday 8 November is after today
    key(day('2026-11-03'), 'ArrowUp');
    key(day('2026-10-27'), 'End');
    expect(focused()).toBe('2026-11-01');
  });
  it('Page Up and Page Down move by a month, Shift by a year; moving past the shown months turns the page', async () => {
    const t = await startTestApp();
    await t.click('#datesBtn');
    key(day('2026-11-03'), 'PageUp');
    expect(focused()).toBe('2026-10-03');
    expect(titles()).toEqual(['Oktober 2026', 'November 2026']);
    key(day('2026-10-03'), 'PageUp');
    expect(focused()).toBe('2026-09-03');
    expect(titles()).toEqual(['September 2026', 'Oktober 2026']);
    key(day('2026-09-03'), 'PageDown');
    expect(focused()).toBe('2026-10-03');
    key(day('2026-10-03'), 'PageUp', { shiftKey: true });
    expect(focused()).toBe('2025-10-03');
    expect(titles()).toEqual(['Oktober 2025', 'November 2025']);
    key(day('2025-10-03'), 'ArrowLeft');
    key(day('2025-10-03'), 'ArrowLeft');
    expect(focused()).toBe('2025-10-03'); // the first allowed day
    key(day('2025-10-03'), 'PageDown', { shiftKey: true });
    expect(focused()).toBe('2026-10-03');
    key(day('2026-10-03'), 'PageDown', { shiftKey: true });
    expect(focused()).toBe('2026-11-03'); // clamped to today
    expect(titles()).toEqual(['Oktober 2026', 'November 2026']);
  });
  it('paging carries the tab stop into view; only one day has it', async () => {
    const t = await startTestApp();
    await t.click('#datesBtn');
    await t.click('.cal-nav[data-nav="prev"]');
    expect(titles()).toEqual(['September 2026', 'Oktober 2026']);
    expect(document.querySelectorAll('#datesCal button[tabindex="0"]')).toHaveLength(1);
    expect(focused()).toBe('2026-10-03');
  });
  it('Ctrl+Enter or Cmd+Enter shows the range from anywhere in the panel', async () => {
    const t = await startTestApp();
    await t.click('#datesBtn');
    key(day('2026-11-03'), 'ArrowLeft');
    key(day('2026-11-02'), 'Enter');
    key(day('2026-11-02'), 'Enter', { ctrlKey: true });
    await flush();
    expect(t.$('datesPanel').hidden).toBe(true);
    expect(t.$('datesText').textContent).toBe('Mo 2.11.');
    await t.click('#datesBtn');
    key(day('2026-11-02'), 'Enter', { metaKey: true });
    await flush();
    expect(t.$('datesPanel').hidden).toBe(true);
    expect(t.$('datesText').textContent).toBe('Mo 2.11.');
  });
  it('focus stays on the same day when the pick changes, and on the paging button when it can page', async () => {
    const t = await startTestApp();
    await t.click('#datesBtn');
    const prev = () => document.querySelector<HTMLButtonElement>('.cal-nav[data-nav="prev"]')!;
    prev().focus();
    prev().click();
    await flush();
    expect(document.activeElement).toBe(prev());
    day('2026-10-05').focus();
    day('2026-10-05').click();
    await flush();
    expect(document.activeElement).toBe(day('2026-10-05'));
  });
  it('Escape closes the panel from a day, without change, and returns focus to the segment', async () => {
    const t = await startTestApp();
    await t.click('#datesBtn');
    key(day('2026-11-03'), 'Escape');
    expect(t.$('datesPanel').hidden).toBe(true);
    expect(t.$('datesBtn').getAttribute('aria-pressed')).toBe('false');
    expect(document.activeElement).toBe(t.$('datesBtn'));
  });
});

describe('the date panel', () => {
  it('apply closes the panel and returns focus to the segment', async () => {
    const t = await startTestApp();
    await pick(t, '2026-10-12', '2026-10-16');
    expect(t.$('datesPanel').hidden).toBe(true);
    expect(t.$('datesBtn').getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(t.$('datesBtn'));
  });
  it('Escape closes without change and returns focus', async () => {
    const t = await startTestApp();
    await t.click('#datesBtn');
    escape();
    expect(t.$('datesPanel').hidden).toBe(true);
    expect(t.$('datesBtn').getAttribute('aria-expanded')).toBe('false');
    expect(t.$('datesBtn').getAttribute('aria-pressed')).toBe('false');
    expect(document.activeElement).toBe(t.$('datesBtn'));
  });
  it('a click outside closes it; a second click on the segment closes it too', async () => {
    const t = await startTestApp();
    await t.click('#datesBtn');
    document.getElementById('status')!.click();
    expect(t.$('datesPanel').hidden).toBe(true);
    await t.click('#datesBtn');
    await t.click('#datesBtn');
    expect(t.$('datesPanel').hidden).toBe(true);
  });
  it('a click inside the calendar does not close it', async () => {
    const t = await startTestApp();
    await t.click('#datesBtn');
    await clickDay('2026-10-12');
    expect(t.$('datesPanel').hidden).toBe(false);
  });
});

describe('the selection in the page', () => {
  it('chosen dates load that range once with the matching window; the fixed range is not refreshed by live messages', async () => {
    const t = await startTestApp({ echarts: fakeEcharts().api });
    await pick(t, '2026-10-12', '2026-10-16');
    const q = t.historyQueries().at(-1)!;
    expect(q).toContain('range(start: 2026-10-11T22:00:00Z, stop: 2026-10-16T22:00:00Z)');
    expect(q).toContain('every: 30m');
    expect(t.$('winCo2').textContent).toBe('12.10. – 16.10.2026 · ppm');
    const fixed = () => t.historyQueries().filter((x) => x.includes('2026-10-11T22:00:00Z')).length;
    expect(fixed()).toBe(1);
    await t.connect();
    t.mqtt.message('leoiot/room-climate/105', { room: '105', device: 'nili3', source: 'sensor', ts: Math.floor((Date.parse('2026-11-03T06:36:30Z') + t.timers.now) / 1000), co2: 900 });
    await t.advance(60_000);
    await t.advance(60_000);
    expect(fixed()).toBe(1);
    // the 24-hour series keeps refreshing
    expect(t.historyQueries().filter((x) => x.includes('every: 5m')).length).toBeGreaterThan(1);
  });
  it('a range ending today keeps refreshing', async () => {
    const t = await startTestApp({ echarts: fakeEcharts().api });
    await pick(t, '2026-11-01', '2026-11-03');
    const live = () => t.historyQueries().filter((x) => x.includes('range(start: 2026-10-31T23:00:00Z')).length;
    expect(live()).toBe(1);
    expect(t.$('winCo2').textContent).toBe('1.11., 00:00 – 3.11., 07:36 · ppm');
    await t.advance(60_000);
    expect(live()).toBeGreaterThan(1);
  });
  it('24 h clears the dates and 7 Tage too', async () => {
    const t = await startTestApp();
    await pick(t, '2026-10-12', '2026-10-16');
    await t.click('[data-range="24h"]');
    expect(t.$('datesText').textContent).toBe('');
    expect(t.$('datesBtn').getAttribute('aria-pressed')).toBe('false');
    expect(t.$('rangeGroup').querySelector('[data-range="24h"]')!.getAttribute('aria-pressed')).toBe('true');
    expect(t.$('winCo2').textContent).toBe('2.11., 07:36 – 3.11., 07:36 · ppm');
    await pick(t, '2026-10-12', '2026-10-16');
    await t.click('[data-range="7d"]');
    expect(t.$('datesBtn').getAttribute('aria-pressed')).toBe('false');
  });
  it('the charts get the chosen range as axis', async () => {
    const e = fakeEcharts();
    const t = await startTestApp({ echarts: e.api });
    await pick(t, '2026-10-12', '2026-10-16');
    const o = e.charts[0].options.at(-1) as any;
    expect([o.xAxis.min, o.xAxis.max]).toEqual([Date.parse('2026-10-11T22:00:00Z'), Date.parse('2026-10-16T22:00:00Z')]);
  });
  it('the room panel, lamp, values and Heute do not change', async () => {
    const t = await startTestApp({ echarts: fakeEcharts().api });
    const ids = ['status', 'why', 'vCo2', 'vTemp', 'vHum', 'fresh', 'vAbove', 'vPeak', 'vAired', 'light'];
    const read = () => [...ids.map((i) => t.$(i).textContent + '|' + (t.$(i).getAttribute('aria-label') ?? '')), t.$('app').dataset.air, t.$('app').dataset.state];
    const before = read();
    await pick(t, '2026-10-12', '2026-10-16');
    expect(read()).toEqual(before);
    await pick(t, '2026-01-01', '2026-10-31');
    expect(read()).toEqual(before);
    expect(t.historyQueries().at(-1)).toContain('every: 1d');
  });
});
