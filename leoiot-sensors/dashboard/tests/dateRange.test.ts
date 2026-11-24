// Chosen dates: bounds, windows, allowed span, validation, query, chart labels (task group 1).
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from 'vitest';
import { co2Option, humidityOption, temperatureOption, type ChartInput, type Palette } from '../src/core/chartOptions';
import { historyQuery } from '../src/core/flux';
import { makeFormat } from '../src/core/format';
import { allowedDates, isLive, selectionBounds, selectionWindow, validateDates, type Selection } from '../src/core/ranges';
import { datesRangeFull, datesSegmentText, windowText } from '../src/core/rangeLabels';

const NOW = Date.parse('2026-11-23T09:41:30Z'); // Mon 23 Nov 2026, 10:41:30 Vienna
const H = 3_600_000;
const dates = (from: string, to: string): Selection => ({ kind: 'dates', from, to });
const iso = (ms: number) => new Date(ms).toISOString();

describe('selectionBounds', () => {
  it('24 h and 7 days end now, floored to whole seconds', () => {
    expect(selectionBounds({ kind: '24h' }, NOW + 400)).toEqual({ start: Date.parse('2026-11-22T09:41:30Z'), end: NOW });
    expect(selectionBounds({ kind: '7d' }, NOW)).toEqual({ start: Date.parse('2026-11-16T09:41:30Z'), end: NOW });
  });
  it('one day: local midnight to local midnight', () => {
    const b = selectionBounds(dates('2026-11-17', '2026-11-17'), NOW);
    expect([iso(b.start), iso(b.end)]).toEqual(['2026-11-16T23:00:00.000Z', '2026-11-17T23:00:00.000Z']);
  });
  it('several days', () => {
    const b = selectionBounds(dates('2026-11-16', '2026-11-20'), NOW);
    expect([iso(b.start), iso(b.end)]).toEqual(['2026-11-15T23:00:00.000Z', '2026-11-20T23:00:00.000Z']);
  });
  it('ending today: capped at now', () => {
    const b = selectionBounds(dates('2026-11-20', '2026-11-23'), NOW);
    expect([iso(b.start), iso(b.end)]).toEqual(['2026-11-19T23:00:00.000Z', '2026-11-23T09:41:30.000Z']);
  });
  it('29 March 2026 has 23 hours', () => {
    const b = selectionBounds(dates('2026-03-29', '2026-03-29'), NOW);
    expect(iso(b.start)).toBe('2026-03-28T23:00:00.000Z');
    expect(iso(b.end)).toBe('2026-03-29T22:00:00.000Z');
    expect(b.end - b.start).toBe(23 * H);
  });
  it('25 October 2026 has 25 hours', () => {
    const b = selectionBounds(dates('2026-10-25', '2026-10-25'), NOW);
    expect(iso(b.start)).toBe('2026-10-24T22:00:00.000Z');
    expect(iso(b.end)).toBe('2026-10-25T23:00:00.000Z');
    expect(b.end - b.start).toBe(25 * H);
  });
});

describe('selectionWindow and isLive', () => {
  const win = (from: string, to: string) => selectionWindow(dates(from, to), NOW).every;
  it('fixed windows for 24 h and 7 days', () => {
    expect(selectionWindow({ kind: '24h' }, NOW)).toEqual({ every: '5m', everyMs: 300_000 });
    expect(selectionWindow({ kind: '7d' }, NOW)).toEqual({ every: '30m', everyMs: 1_800_000 });
  });
  it('thresholds at 2, 14 and 93 days', () => {
    expect(win('2026-11-01', '2026-11-02')).toBe('5m'); // 2 days
    expect(win('2026-11-01', '2026-11-03')).toBe('30m'); // 3 days
    expect(win('2026-11-01', '2026-11-14')).toBe('30m'); // 14 days
    expect(win('2026-11-01', '2026-11-15')).toBe('4h');
    expect(win('2026-07-01', '2026-10-01')).toBe('4h'); // 93 days
    expect(win('2026-07-01', '2026-10-02')).toBe('1d'); // 94 days
    expect(selectionWindow(dates('2026-01-01', '2026-10-31'), NOW)).toEqual({ every: '1d', everyMs: 86_400_000 });
  });
  it('counts calendar days, so a DST day does not push a range over a threshold', () => {
    expect(win('2026-10-24', '2026-10-25')).toBe('5m'); // 49 h, but 2 days
    expect(win('2026-10-12', '2026-10-25')).toBe('30m'); // 14 days including the 25 h day
    expect(win('2026-11-22', '2026-11-23')).toBe('5m'); // ending today
  });
  it('live: 24 h, 7 days and dates ending today', () => {
    expect(isLive({ kind: '24h' }, NOW)).toBe(true);
    expect(isLive({ kind: '7d' }, NOW)).toBe(true);
    expect(isLive(dates('2026-11-20', '2026-11-23'), NOW)).toBe(true);
    expect(isLive(dates('2026-11-20', '2026-11-22'), NOW)).toBe(false);
  });
});

describe('allowedDates and validateDates', () => {
  it('today back to the same day 13 months earlier', () => {
    expect(allowedDates(NOW)).toEqual({ min: '2025-10-23', max: '2026-11-23' });
  });
  it('clamps to the last day of the month', () => {
    expect(allowedDates(Date.parse('2026-03-31T10:00:00Z'))).toEqual({ min: '2025-02-28', max: '2026-03-31' });
    expect(allowedDates(Date.parse('2026-01-15T10:00:00Z')).min).toBe('2024-12-15');
  });
  it('today is taken in local time', () => {
    expect(allowedDates(Date.parse('2026-11-23T23:30:00Z')).max).toBe('2026-11-24');
  });
  it('all results', () => {
    expect(validateDates('2026-11-17', '2026-11-20', NOW)).toBe('ok');
    expect(validateDates('2026-11-17', '2026-11-17', NOW)).toBe('ok');
    expect(validateDates('2025-10-23', '2026-11-23', NOW)).toBe('ok');
    expect(validateDates('', '2026-11-20', NOW)).toBe('invalid');
    expect(validateDates('2026-02-30', '2026-11-20', NOW)).toBe('invalid');
    expect(validateDates('2026-11-20', '2026-11-17', NOW)).toBe('order');
    expect(validateDates('2025-10-22', '2026-11-20', NOW)).toBe('span');
    expect(validateDates('2026-11-20', '2026-11-24', NOW)).toBe('span');
  });
});

describe('historyQuery', () => {
  const b = { start: Date.parse('2026-11-16T23:00:00Z'), end: Date.parse('2026-11-17T23:00:00Z') };
  it('five minutes: no timezone lines, no timeSrc', () => {
    const q = historyQuery('105', 'sensor', b, '5m');
    expect(q.startsWith('from(bucket')).toBe(true);
    expect(q).not.toContain('timezone');
    expect(q).not.toContain('timeSrc');
    expect(q).toContain('range(start: 2026-11-16T23:00:00Z, stop: 2026-11-17T23:00:00Z)');
  });
  it('one day and four hours: local time windows stamped at their start, imports first', () => {
    for (const every of ['1d', '4h'] as const) {
      const lines = historyQuery('105', 'sensor', b, every).split('\n');
      expect(lines[0]).toBe('import "timezone"');
      expect(lines[1]).toBe('option location = timezone.location(name: "Europe/Vienna")');
      expect(lines[2]).toBe('from(bucket: "server_data")');
      expect(lines.join('\n')).toContain(`aggregateWindow(every: ${every}, fn: mean, createEmpty: true, timeSrc: "_start")`);
    }
  });
});

describe('labels', () => {
  const de = makeFormat('de');
  const en = makeFormat('en');
  it('window text: whole days, one day, several days, years, ending today', () => {
    expect(windowText({ kind: '24h' }, NOW, de)).toBe('22.11., 10:41 – 23.11., 10:41');
    expect(windowText(dates('2026-11-17', '2026-11-17'), NOW, de)).toBe('Di 17.11.2026');
    expect(windowText(dates('2026-11-17', '2026-11-17'), NOW, en)).toBe('Tue 17 Nov 2026');
    expect(windowText(dates('2026-11-16', '2026-11-20'), NOW, de)).toBe('16.11. – 20.11.2026');
    expect(windowText(dates('2026-11-16', '2026-11-20'), NOW, en)).toBe('16 Nov – 20 Nov 2026');
    expect(windowText(dates('2025-12-30', '2026-01-02'), NOW, de)).toBe('30.12.2025 – 2.1.2026');
    expect(windowText(dates('2026-11-20', '2026-11-23'), NOW, de)).toBe('20.11., 00:00 – 23.11., 10:41');
    expect(windowText(dates('2025-12-01', '2026-11-23'), NOW, de)).toBe('1.12.2025, 00:00 – 23.11.2026, 10:41');
  });
  it('segment text and accessible name', () => {
    expect(datesSegmentText(dates('2026-11-16', '2026-11-20') as any, NOW, de)).toBe('16.11. – 20.11.');
    expect(datesSegmentText(dates('2026-11-16', '2026-11-20') as any, NOW, en)).toBe('16 Nov – 20 Nov');
    expect(datesSegmentText(dates('2025-11-16', '2025-11-20') as any, NOW, de)).toBe('16.11.2025 – 20.11.2025');
    expect(datesSegmentText(dates('2026-11-17', '2026-11-17') as any, NOW, de)).toBe('Di 17.11.');
    expect(datesRangeFull(dates('2026-11-16', '2026-11-20') as any, de)).toBe('16.11.2026 – 20.11.2026');
    expect(datesRangeFull(dates('2026-11-16', '2026-11-20') as any, en)).toBe('16 Nov 2026 – 20 Nov 2026');
  });
});

describe('chart axis and tooltip by span', () => {
  const palette: Palette = { font: 'Lexend', ink: '#i', ink3: '#i3', line: '#l', lineStrong: '#s', panel: '#p', humidity: '#h', bandGood: '#g', bandSoon: '#s', bandBad: '#b' };
  const input = (selection: Selection, lang: 'de' | 'en' = 'de'): ChartInput => ({ points: [], selection, now: NOW, lang, format: makeFormat(lang), palette, simulated: false });
  const label = (sel: Selection, t: string, lang: 'de' | 'en' = 'de') => (temperatureOption(input(sel, lang)) as any).xAxis.axisLabel.formatter(Date.parse(t));
  it('axis min and max are the selection bounds', () => {
    const sel = dates('2026-11-16', '2026-11-20');
    const o = co2Option(input(sel)) as any;
    const b = selectionBounds(sel, NOW);
    expect([o.xAxis.min, o.xAxis.max]).toEqual([b.start, b.end]);
    expect([(humidityOption(input(sel)) as any).xAxis.min]).toEqual([b.start]);
  });
  it('times up to 2 days, weekday and day up to 14 days, day and month beyond', () => {
    expect(label(dates('2026-11-17', '2026-11-17'), '2026-11-17T11:00:00Z')).toBe('12:00');
    expect(label(dates('2026-11-16', '2026-11-20'), '2026-11-17T11:00:00Z')).toBe('Di., 17.');
    expect(label(dates('2026-11-16', '2026-11-20'), '2026-11-17T11:00:00Z', 'en')).toBe('Tue 17');
    expect(label(dates('2026-10-01', '2026-11-20'), '2026-11-16T11:00:00Z')).toBe('16.11.');
    expect(label(dates('2026-10-01', '2026-11-20'), '2026-11-16T11:00:00Z', 'en')).toBe('16 Nov');
  });
  const tip = (sel: Selection, t: string, lang: 'de' | 'en' = 'de') =>
    (co2Option(input(sel, lang)) as any).tooltip.formatter([{ value: [Date.parse(t), 700], seriesName: 'CO₂', seriesId: 'co2' }]) as string;
  it('four-hour means name their window, one-day means the day', () => {
    expect(tip(dates('2026-10-01', '2026-11-20'), '2026-11-16T11:00:00Z')).toContain('Mittel 12:00–16:00');
    expect(tip(dates('2026-10-01', '2026-11-20'), '2026-11-16T11:00:00Z', 'en')).toContain('Mean 12:00–16:00');
    expect(tip(dates('2026-01-01', '2026-10-31'), '2026-10-24T22:00:00Z')).toContain('Tagesmittel · So 25.10.2026');
    expect(tip(dates('2026-01-01', '2026-10-31'), '2026-10-24T22:00:00Z', 'en')).toContain('Daily mean · Sun 25 Oct 2026');
  });
  it('five-minute means keep the plain time', () => {
    expect(tip({ kind: '24h' }, '2026-11-23T09:00:00Z')).toContain('23.11., 10:00');
  });
});
