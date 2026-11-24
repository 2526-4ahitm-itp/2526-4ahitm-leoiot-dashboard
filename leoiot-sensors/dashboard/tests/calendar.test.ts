// The logic of the range calendar (sensors-range-calendar-room-filter, task 1.1).
import { describe, expect, it } from 'vitest';
import { calendarNames, clampRightMonth, dayState, monthGrid, monthLimits, moveFocus, pickDay, shiftDayByMonths, shiftMonth, weekEnd, weekStart, type Pick } from '../src/core/calendar';
import { allowedDates } from '../src/core/ranges';

// "Now" is Monday 23 November 2026, 11:41 in Vienna. Allowed days: 2025-10-23 to 2026-11-23.
const NOW = Date.parse('2026-11-23T10:41:00Z');
const allowed = allowedDates(NOW);
const TODAY = '2026-11-23';

describe('month grid, Monday first', () => {
  it('a month that starts on a Sunday leads with six empty cells', () => {
    const weeks = monthGrid(2026, 11);
    expect(weeks).toHaveLength(6);
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    expect(weeks[0]).toEqual([null, null, null, null, null, null, '2026-11-01']);
    expect(weeks[5]).toEqual(['2026-11-30', null, null, null, null, null, null]);
  });
  it('a month that starts on a Monday has no leading cells and fills whole weeks', () => {
    const weeks = monthGrid(2021, 2);
    expect(weeks).toHaveLength(4);
    expect(weeks[0][0]).toBe('2021-02-01');
    expect(weeks[3][6]).toBe('2021-02-28');
    expect(weeks.flat().every((d) => d !== null)).toBe(true);
  });
  it('February of a leap year has 29 days, otherwise 28', () => {
    const days = (y: number) => monthGrid(y, 2).flat().filter((d) => d !== null);
    expect(days(2024)).toHaveLength(29);
    expect(days(2024).at(-1)).toBe('2024-02-29');
    expect(days(2026)).toHaveLength(28);
    expect(days(2100)).toHaveLength(28); // not a leap year
  });
  it('a mid-week start: Thursday 1 February 2024', () => {
    expect(monthGrid(2024, 2)[0]).toEqual([null, null, null, '2024-02-01', '2024-02-02', '2024-02-03', '2024-02-04']);
  });
  it('days of the month are in order and complete', () => {
    const flat = monthGrid(2026, 12).flat().filter((d): d is string => d !== null);
    expect(flat).toHaveLength(31);
    expect([...flat].sort()).toEqual(flat);
  });
});

describe('the click rule', () => {
  const none: Pick = { from: null, to: null };
  it('the first click sets the first day', () => {
    expect(pickDay(none, '2026-11-16')).toEqual({ from: '2026-11-16', to: null });
  });
  it('the second click on a later day sets the last day', () => {
    expect(pickDay({ from: '2026-11-16', to: null }, '2026-11-20')).toEqual({ from: '2026-11-16', to: '2026-11-20' });
  });
  it('the second click on the same day makes a one-day range', () => {
    expect(pickDay({ from: '2026-11-16', to: null }, '2026-11-16')).toEqual({ from: '2026-11-16', to: '2026-11-16' });
  });
  it('a click on an earlier day starts again, without an error', () => {
    expect(pickDay({ from: '2026-11-20', to: null }, '2026-11-17')).toEqual({ from: '2026-11-17', to: null });
  });
  it('a click after a complete range starts again, whichever day', () => {
    const full = { from: '2026-11-16', to: '2026-11-20' };
    expect(pickDay(full, '2026-11-18')).toEqual({ from: '2026-11-18', to: null });
    expect(pickDay(full, '2026-11-22')).toEqual({ from: '2026-11-22', to: null });
    expect(pickDay(full, '2026-11-01')).toEqual({ from: '2026-11-01', to: null });
  });
  it('works across months and years', () => {
    expect(pickDay({ from: '2025-12-30', to: null }, '2026-01-02')).toEqual({ from: '2025-12-30', to: '2026-01-02' });
  });
});

describe('the state of a day', () => {
  const state = (day: string, pick: Pick, hover: string | null = null) => dayState(day, pick, hover, allowed, TODAY);
  const range: Pick = { from: '2026-11-16', to: '2026-11-20' };
  it('start, inside, end, outside', () => {
    expect(state('2026-11-16', range).role).toBe('start');
    expect(state('2026-11-18', range).role).toBe('inside');
    expect(state('2026-11-20', range).role).toBe('end');
    expect(state('2026-11-15', range).role).toBe('none');
    expect(state('2026-11-21', range).role).toBe('none');
  });
  it('one day, picked once or twice, is a single', () => {
    expect(state('2026-11-17', { from: '2026-11-17', to: null }).role).toBe('single');
    expect(state('2026-11-17', { from: '2026-11-17', to: '2026-11-17' }).role).toBe('single');
    expect(state('2026-11-18', { from: '2026-11-17', to: '2026-11-17' }).role).toBe('none');
  });
  it('nothing picked: no day has a role', () => {
    expect(state('2026-11-17', { from: null, to: null }).role).toBe('none');
  });
  it('hover previews the range while only the first day is picked', () => {
    const first: Pick = { from: '2026-11-16', to: null };
    expect(state('2026-11-16', first, '2026-11-19')).toMatchObject({ role: 'start', preview: true });
    expect(state('2026-11-18', first, '2026-11-19')).toMatchObject({ role: 'inside', preview: true });
    expect(state('2026-11-19', first, '2026-11-19')).toMatchObject({ role: 'end', preview: true });
    expect(state('2026-11-20', first, '2026-11-19').role).toBe('none');
  });
  it('no preview when hovering before or on the first day, or after a complete range', () => {
    const first: Pick = { from: '2026-11-16', to: null };
    expect(state('2026-11-16', first, '2026-11-14')).toMatchObject({ role: 'single', preview: false });
    expect(state('2026-11-15', first, '2026-11-14').role).toBe('none');
    expect(state('2026-11-18', range, '2026-11-22')).toMatchObject({ role: 'inside', preview: false });
    expect(state('2026-11-22', range, '2026-11-22').role).toBe('none');
  });
  it('the allowed span edges: first and last allowed day are open, the days next to them are not', () => {
    expect(allowed).toEqual({ min: '2025-10-23', max: '2026-11-23' });
    expect(state('2025-10-23', range).disabled).toBe(false);
    expect(state('2025-10-22', range).disabled).toBe(true);
    expect(state('2026-11-23', range).disabled).toBe(false);
    expect(state('2026-11-24', range).disabled).toBe(true);
  });
  it('a preview never reaches into days that cannot be picked', () => {
    expect(state('2026-11-23', { from: '2026-11-20', to: null }, '2026-11-25').role).toBe('none');
  });
  it('marks today', () => {
    expect(state('2026-11-23', range).today).toBe(true);
    expect(state('2026-11-22', range).today).toBe(false);
  });
});

describe('paging', () => {
  it('shifts months across years', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-11', 2)).toBe('2027-01');
    expect(shiftMonth('2026-11', -23)).toBe('2024-12');
  });
  it('the first and last month with an allowed day', () => {
    expect(monthLimits(allowed)).toEqual({ first: '2025-10', last: '2026-11' });
  });
  it('the right month stays inside the limits for one or two shown months', () => {
    expect(clampRightMonth('2026-12', 2, allowed)).toBe('2026-11');
    expect(clampRightMonth('2026-11', 2, allowed)).toBe('2026-11');
    expect(clampRightMonth('2025-10', 2, allowed)).toBe('2025-11'); // the left month is October 2025
    expect(clampRightMonth('2025-01', 1, allowed)).toBe('2025-10');
    expect(clampRightMonth('2026-05', 1, allowed)).toBe('2026-05');
  });
  it('a day number moves by months and is cut to the shorter month', () => {
    expect(shiftDayByMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(shiftDayByMonths('2026-03-31', -1)).toBe('2026-02-28');
    expect(shiftDayByMonths('2024-01-31', 1)).toBe('2024-02-29');
    expect(shiftDayByMonths('2026-11-23', 14)).toBe('2028-01-23');
  });
});

describe('moving the focus', () => {
  it('days and weeks, also across month ends', () => {
    expect(moveFocus('2026-11-10', 'day', 1, allowed)).toBe('2026-11-11');
    expect(moveFocus('2026-11-01', 'day', -1, allowed)).toBe('2026-10-31');
    expect(moveFocus('2026-11-10', 'week', -1, allowed)).toBe('2026-11-03');
    expect(moveFocus('2026-10-28', 'week', 1, allowed)).toBe('2026-11-04');
  });
  it('the start and end of the week, Monday to Sunday', () => {
    expect(weekStart('2026-11-22')).toBe('2026-11-16'); // a Sunday
    expect(weekStart('2026-11-16')).toBe('2026-11-16');
    expect(weekEnd('2026-11-16')).toBe('2026-11-22');
    expect(moveFocus('2026-11-18', 'weekStart', 0, allowed)).toBe('2026-11-16');
    expect(moveFocus('2026-11-18', 'weekEnd', 0, allowed)).toBe('2026-11-22');
  });
  it('months and years', () => {
    expect(moveFocus('2026-11-18', 'month', -1, allowed)).toBe('2026-10-18');
    expect(moveFocus('2026-11-18', 'year', -1, allowed)).toBe('2025-11-18');
  });
  it('stays inside the allowed span', () => {
    expect(moveFocus('2026-11-23', 'day', 1, allowed)).toBe('2026-11-23');
    expect(moveFocus('2026-11-23', 'weekEnd', 0, allowed)).toBe('2026-11-23');
    expect(moveFocus('2025-10-25', 'month', -1, allowed)).toBe('2025-10-23');
    expect(moveFocus('2026-11-18', 'year', -2, allowed)).toBe('2025-10-23');
  });
});

describe('names', () => {
  it('month heading and full date in German and English', () => {
    expect(calendarNames('de').month('2026-11')).toBe('November 2026');
    expect(calendarNames('de').day('2026-11-16')).toBe('Montag, 16. November 2026');
    expect(calendarNames('en').month('2026-03')).toBe('March 2026');
    expect(calendarNames('en').day('2026-11-16')).toMatch(/^Monday,? 16 November 2026$/);
  });
});
