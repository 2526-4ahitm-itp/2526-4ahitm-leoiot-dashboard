import { describe, expect, it } from 'vitest';
import { parseAnnotatedCsv } from '../src/core/csv';
import { peakQuery } from '../src/core/flux';
import { makeFormat, startOfLocalDay } from '../src/core/format';
import { AIRING_DROP_PPM, AIRING_WITHIN_WINDOWS, deriveToday, lastAiring, minutesAbove, parsePeak, todaysWindows, withCurrent } from '../src/core/today';
import { loadPeak } from '../src/data/load';
import { fixture } from './helpers';

const STEP = 5 * 60_000;
const utc = (iso: string) => Date.parse(iso);

describe('midnight in Europe/Vienna', () => {
  it.each([
    ['a winter day', '2026-01-15T10:20:00Z', '2026-01-14T23:00:00Z'],
    ['a summer day', '2026-07-01T10:20:00Z', '2026-06-30T22:00:00Z'],
    ['the day the clocks go forward (29 March), before the change', '2026-03-29T00:30:00Z', '2026-03-28T23:00:00Z'],
    ['the day the clocks go forward, after the change', '2026-03-29T08:00:00Z', '2026-03-28T23:00:00Z'],
    ['the day the clocks go back (25 October), before the change', '2026-10-25T00:10:00Z', '2026-10-24T22:00:00Z'],
    ['the day the clocks go back, in the repeated hour', '2026-10-25T01:30:00Z', '2026-10-24T22:00:00Z'],
    ['the day the clocks go back, after the change', '2026-10-25T09:00:00Z', '2026-10-24T22:00:00Z'],
    ['exactly at midnight', '2026-01-14T23:00:00Z', '2026-01-14T23:00:00Z'],
    ['one second before midnight', '2026-01-14T22:59:59Z', '2026-01-13T23:00:00Z'],
    ['with milliseconds', '2026-01-15T10:20:00.750Z', '2026-01-14T23:00:00Z'],
  ])('%s', (_name, now, midnight) => {
    expect(startOfLocalDay(utc(now))).toBe(utc(midnight));
  });
  it('agrees with the local clock: 00:00 on the page', () => {
    const f = makeFormat('de');
    for (const iso of ['2026-03-29T12:00:00Z', '2026-10-25T12:00:00Z', '2026-11-19T07:00:00Z']) expect(f.time(startOfLocalDay(utc(iso)))).toBe('00:00');
  });
});

/** A five-minute series from `from` (window end) with a value per window index. */
const series = (from: string, n: number, co2: (i: number) => number | null) => Array.from({ length: n }, (_, i) => ({ t: utc(from) + i * STEP, co2: co2(i) }));

describe('time above 1000 ppm', () => {
  const midnight = utc('2026-11-18T23:00:00Z'); // 19 November, Vienna
  it('counts five minutes per window whose mean is above 1000; 1000 itself is not above', () => {
    const s = series('2026-11-19T07:00:00Z', 20, (i) => (i < 5 ? 1000 : i < 21 ? 1001 : 0));
    expect(minutesAbove(s)).toBe(15 * 5);
  });
  it('windows of yesterday are ignored; a window ending at midnight is yesterday\'s', () => {
    const s = series('2026-11-18T22:50:00Z', 6, () => 1500); // ends 22:50, 22:55, 23:00, 23:05, ... UTC
    const today = todaysWindows(s, midnight, utc('2026-11-19T10:00:00Z'));
    expect(today.map((p) => p.t)).toEqual([utc('2026-11-18T23:05:00Z'), utc('2026-11-18T23:10:00Z'), utc('2026-11-18T23:15:00Z')]);
  });
  it('gaps (null) are ignored', () => {
    expect(minutesAbove(series('2026-11-19T07:00:00Z', 4, (i) => (i % 2 ? null : 1200)))).toBe(10);
  });
});

describe('last airing (parameters are design parameters, not health limits)', () => {
  it('the parameters', () => {
    expect([AIRING_DROP_PPM, AIRING_WITHIN_WINDOWS]).toEqual([200, 3]);
  });
  it('school day: a fall from 1380 to 1020 between 10:45 and 10:55 is an airing at about 10:45', () => {
    // Vienna 10:45 is 09:45 UTC in November
    const s = series('2026-11-19T09:40:00Z', 8, (i) => [900, 1380, 1000, 1020, 1000, 1000, 1000, 1000][i]);
    expect(lastAiring(s)).toBe(utc('2026-11-19T09:45:00Z'));
    expect(makeFormat('de').time(lastAiring(s)!)).toBe('10:45');
  });
  it('the latest of several airings wins', () => {
    const s = series('2026-11-19T08:00:00Z', 12, (i) => [1500, 1100, 1000, 1000, 1000, 1400, 1300, 1150, 1000, 1000, 1000, 1000][i]);
    expect(lastAiring(s)).toBe(utc('2026-11-19T08:30:00Z')); // 1300 falls to 1000 within three windows; 1150 does not fall further
  });
  it('early morning: no fall of 200 ppm: none', () => {
    expect(lastAiring(series('2026-11-19T00:00:00Z', 60, (i) => 500 + (i % 7) * 20))).toBeNull();
  });
  it('a slow fall is not an airing: 200 ppm takes longer than fifteen minutes', () => {
    expect(lastAiring(series('2026-11-19T08:00:00Z', 8, (i) => 1400 - i * 60))).toBeNull(); // 180 ppm in three windows
    expect(lastAiring(series('2026-11-19T08:00:00Z', 8, (i) => 1400 - i * 70))).not.toBeNull(); // 210 ppm in three windows
  });
  it('exactly 200 ppm within three windows counts, 199 does not, four windows do not', () => {
    expect(lastAiring(series('2026-11-19T08:00:00Z', 4, (i) => [1000, 900, 850, 800][i]))).not.toBeNull();
    expect(lastAiring(series('2026-11-19T08:00:00Z', 4, (i) => [1000, 950, 900, 801][i]))).toBeNull();
    expect(lastAiring(series('2026-11-19T08:00:00Z', 5, (i) => [1000, 950, 900, 850, 800][i]))).toBeNull();
  });
  it('gaps do not bridge a fall: windows are compared by time, nulls are skipped', () => {
    expect(lastAiring(series('2026-11-19T08:00:00Z', 4, (i) => [1400, null, null, 1000][i]))).toBe(utc('2026-11-19T08:00:00Z'));
    expect(lastAiring(series('2026-11-19T08:00:00Z', 4, (i) => [null, null, null, null][i]))).toBeNull();
  });
});

describe('the day', () => {
  const midnight = utc('2026-11-18T23:00:00Z');
  const now = utc('2026-11-19T12:10:00Z'); // 13:10 Vienna
  it('a school day: 1 h 20 min above 1000 ppm, last aired at 10:45, peak as given', () => {
    const s = series('2026-11-18T23:05:00Z', (now - midnight) / STEP, (i) => {
      const t = midnight + (i + 1) * STEP;
      if (t === utc('2026-11-19T09:45:00Z')) return 1380;
      if (t === utc('2026-11-19T09:50:00Z')) return 1000;
      if (t === utc('2026-11-19T09:55:00Z')) return 1020;
      if (t > utc('2026-11-19T09:55:00Z')) return 1000;
      return t >= utc('2026-11-19T07:00:00Z') && t <= utc('2026-11-19T08:05:00Z') ? 1100 : 600;
    });
    const peak = { value: 1450, at: utc('2026-11-19T12:05:00Z') };
    expect(deriveToday(s, peak, midnight, now)).toEqual({ empty: false, aboveMinutes: 80, peak, airedAt: utc('2026-11-19T09:45:00Z') });
  });
  it('early morning: not above 1000 ppm, nothing aired, peak so far', () => {
    const peak = { value: 640, at: utc('2026-11-19T01:10:00Z') };
    const s = series('2026-11-18T23:05:00Z', 15, () => 600);
    expect(deriveToday(s, peak, midnight, utc('2026-11-19T00:15:00Z'))).toEqual({ empty: false, aboveMinutes: 0, peak, airedAt: null });
  });
  it('yesterday does not count', () => {
    const s = series('2026-11-18T21:00:00Z', 24, () => 1500); // up to 22:55 UTC: all yesterday
    expect(deriveToday(s, null, midnight, utc('2026-11-18T23:30:00Z'))).toMatchObject({ empty: true, aboveMinutes: 0, airedAt: null });
  });
  it('no reading today: empty; a peak alone is a reading', () => {
    const s = series('2026-11-18T23:05:00Z', 12, () => null);
    expect(deriveToday(s, null, midnight, now).empty).toBe(true);
    expect(deriveToday(s, { value: 700, at: now }, midnight, now).empty).toBe(false);
  });
  it('the current reading counts: a higher one becomes the peak, one from yesterday does not', () => {
    const stored = { value: 900, at: utc('2026-11-19T08:00:00Z') };
    expect(withCurrent(stored, { value: 1100, at: now }, midnight)).toEqual({ value: 1100, at: now });
    expect(withCurrent(stored, { value: 700, at: now }, midnight)).toBe(stored);
    expect(withCurrent(null, { value: 700, at: now }, midnight)).toEqual({ value: 700, at: now });
    expect(withCurrent(null, { value: 700, at: utc('2026-11-18T22:00:00Z') }, midnight)).toBeNull();
    expect(withCurrent(stored, undefined, midnight)).toBe(stored);
  });
  it('a live reading without history yet is not "no readings today"', () => {
    const s = series('2026-11-18T23:05:00Z', 12, () => null);
    expect(deriveToday(s, withCurrent(null, { value: 1490, at: now }, midnight), midnight, now)).toMatchObject({ empty: false, peak: { value: 1490 } });
  });
  it('day change in summer time: midnight is 22:00 UTC', () => {
    const m = startOfLocalDay(utc('2026-07-01T09:00:00Z'));
    const s = series('2026-06-30T21:55:00Z', 6, () => 1200); // 21:55 UTC is 23:55 Vienna on 30 June
    expect(todaysWindows(s, m, utc('2026-07-01T00:00:00Z')).map((p) => p.t)).toEqual([utc('2026-06-30T22:05:00Z'), utc('2026-06-30T22:10:00Z'), utc('2026-06-30T22:15:00Z'), utc('2026-06-30T22:20:00Z')]);
  });
});

describe('peak query and answer', () => {
  const start = utc('2026-11-18T23:00:00Z');
  const end = utc('2026-11-19T12:10:07.500Z');
  it('range from midnight to now, one room and source, co2 only, one row', () => {
    const q = peakQuery('105', 'sensor', start, end);
    expect(q).toContain('range(start: 2026-11-18T23:00:00Z, stop: 2026-11-19T12:10:07Z)');
    expect(q).toContain('r._measurement == "room_climate" and r.room == "105" and r.source == "sensor"');
    expect(q).toContain('r._field == "co2"');
    expect(q).toContain('|> group()');
    expect(q).toContain('|> max()');
    expect(q).toContain('keep(columns: ["_time", "_value"])');
  });
  it('refuses rooms and sources that could break out of the query', () => {
    expect(() => peakQuery('105" or true', 'sensor', start, end)).toThrow();
    expect(() => peakQuery('a/b', 'sensor', start, end)).toThrow();
    expect(() => peakQuery('105', 'x" or true' as never, start, end)).toThrow();
  });
  it('parses the recorded answer', () => {
    expect(parsePeak(parseAnnotatedCsv(fixture('peak105.csv')))).toEqual({ value: 1450, at: utc('2026-11-03T06:05:00Z') });
  });
  it('no row, an empty value or a bad time is no peak; the highest of several rows wins', () => {
    expect(parsePeak([])).toBeNull();
    expect(parsePeak([{ _time: '2026-11-03T06:05:00Z', _value: '' }, { _time: 'x', _value: '5' }])).toBeNull();
    expect(parsePeak([{ _time: '2026-11-03T06:05:00Z', _value: '900' }, { _time: '2026-11-03T07:05:00Z', _value: '950' }])?.value).toBe(950);
  });
  it('the loader asks the query and returns the parsed answer', async () => {
    const asked: string[] = [];
    const peak = await loadPeak(async (q) => (asked.push(q), fixture('peak105.csv')), '105', 'sensor', start, end);
    expect(asked).toHaveLength(1);
    expect(peak?.value).toBe(1450);
    expect(await loadPeak(async () => '', '105', 'sensor', start, end)).toBeNull();
  });
});
