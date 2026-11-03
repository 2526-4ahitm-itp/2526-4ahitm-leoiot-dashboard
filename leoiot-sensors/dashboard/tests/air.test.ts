import { describe, expect, it } from 'vitest';
import { airOf, exceeds, sinceAbove, type CO2Point } from '../src/core/air';

describe('air state thresholds', () => {
  it.each([
    [799, 'good'],
    [800, 'soon'],
    [1000, 'soon'],
    [1001, 'bad'],
    [0, 'good'],
    [5000, 'bad'],
  ] as const)('%d ppm is %s', (ppm, air) => {
    expect(airOf(ppm)).toBe(air);
  });
  it('judges the rounded value, as shown on the page', () => {
    expect(airOf(799.4)).toBe('good');
    expect(airOf(799.5)).toBe('soon');
    expect(airOf(1000.4)).toBe('soon');
    expect(airOf(1000.5)).toBe('bad');
  });
  it('exceeds: 800 counts from 800, 1000 only above 1000', () => {
    expect(exceeds(800, 800)).toBe(true);
    expect(exceeds(800, 799)).toBe(false);
    expect(exceeds(1000, 1000)).toBe(false);
    expect(exceeds(1000, 1001)).toBe(true);
  });
});

const MIN = 60_000;
const series = (values: (number | null)[], start = 0): CO2Point[] => values.map((co2, i) => ({ t: start + i * 5 * MIN, co2 }));

describe('since when above the limit', () => {
  it('start of the current uninterrupted run', () => {
    const pts = series([500, 700, 810, 830, 868]);
    expect(sinceAbove(pts, 800, { at: 4 * 5 * MIN, value: 868 })).toEqual({ at: 2 * 5 * MIN, beforeRange: false });
  });
  it('an earlier run does not count', () => {
    const pts = series([900, 900, 600, 700, 820, 850]);
    expect(sinceAbove(pts, 800, { at: 5 * 5 * MIN, value: 850 })?.at).toBe(4 * 5 * MIN);
  });
  it('a gap ends the run', () => {
    const pts = series([900, 900, null, 820, 850]);
    expect(sinceAbove(pts, 800, { at: 4 * 5 * MIN, value: 850 })?.at).toBe(3 * 5 * MIN);
  });
  it('the limit 1000 has its own run', () => {
    const pts = series([850, 900, 1010, 1100, 1200]);
    expect(sinceAbove(pts, 1000, { at: 4 * 5 * MIN, value: 1200 })?.at).toBe(2 * 5 * MIN);
    expect(sinceAbove(pts, 800, { at: 4 * 5 * MIN, value: 1200 })?.at).toBe(0);
  });
  it('a run that fills the whole series reaches back beyond the range', () => {
    expect(sinceAbove(series([900, 910, 920]), 800, { at: 10 * MIN, value: 920 })).toEqual({ at: 0, beforeRange: true });
  });
  it('current reading above while the newest window mean is not: starts with the reading', () => {
    const pts = series([700, 790]);
    expect(sinceAbove(pts, 800, { at: 8 * MIN, value: 810 })).toEqual({ at: 8 * MIN, beforeRange: false });
  });
  it('trailing empty windows are skipped', () => {
    const pts = series([700, 820, 850, null]);
    expect(sinceAbove(pts, 800, { at: 10 * MIN, value: 850 })?.at).toBe(5 * MIN);
  });
  it('a series far away from the reading says nothing about it', () => {
    expect(sinceAbove(series([900, 900]), 800, { at: 3 * 3_600_000, value: 900 })).toEqual({ at: 3 * 3_600_000, beforeRange: false });
  });
  it('null when the current value is not above the limit', () => {
    expect(sinceAbove(series([900, 900]), 800, { at: 5 * MIN, value: 799 })).toBeNull();
    expect(sinceAbove(series([900, 900]), 1000, { at: 5 * MIN, value: 1000 })).toBeNull();
  });
  it('no series at all', () => {
    expect(sinceAbove([], 800, { at: 5, value: 900 })).toEqual({ at: 5, beforeRange: false });
  });
});
