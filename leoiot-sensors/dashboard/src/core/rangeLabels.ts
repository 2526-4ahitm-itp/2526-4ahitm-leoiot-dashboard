// Texts that name a selection: the window text above the charts, the date segment and its accessible name.
import { localDate, localMidnight, type Format } from './format';
import { selectionBounds, type Selection } from './ranges';

type Dates = Extract<Selection, { kind: 'dates' }>;

/** The window text above a chart (without the unit). */
export function windowText(sel: Selection, now: number, f: Format): string {
  const { start, end } = selectionBounds(sel, now);
  if (sel.kind !== 'dates') return f.window(start, end);
  if (sel.to >= localDate(now)) {
    // Ending now: like the 24 h label, with years when the range starts in another year.
    return sel.from.slice(0, 4) === sel.to.slice(0, 4) ? f.window(start, end) : `${f.dayMonthYear(start)}, ${f.time(start)} – ${f.dayMonthYear(end)}, ${f.time(end)}`;
  }
  const last = localMidnight(sel.to);
  if (sel.from === sel.to) return f.weekdayDateYear(start);
  const sameYear = sel.from.slice(0, 4) === sel.to.slice(0, 4);
  return `${sameYear ? f.dayMonth(start) : f.dayMonthYear(start)} – ${f.dayMonthYear(last)}`;
}

/** The text of the date segment while dates are shown. Years are left out when both days are in this year. */
export function datesSegmentText(sel: Dates, now: number, f: Format): string {
  const a = localMidnight(sel.from);
  const b = localMidnight(sel.to);
  if (sel.from === sel.to) return sel.from.slice(0, 4) === localDate(now).slice(0, 4) ? f.weekdayDate(a) : f.weekdayDateYear(a);
  const thisYear = localDate(now).slice(0, 4);
  const short = sel.from.slice(0, 4) === thisYear && sel.to.slice(0, 4) === thisYear;
  return short ? `${f.dayMonth(a)} – ${f.dayMonth(b)}` : `${f.dayMonthYear(a)} – ${f.dayMonthYear(b)}`;
}

/** The range with years, for the accessible name of the date segment. */
export function datesRangeFull(sel: Dates, f: Format): string {
  const a = localMidnight(sel.from);
  return sel.from === sel.to ? f.weekdayDateYear(a) : `${f.dayMonthYear(a)} – ${f.dayMonthYear(localMidnight(sel.to))}`;
}
