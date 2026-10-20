import { describe, it, expect } from 'vitest';
import {
  addDays,
  dayLabel,
  dayRange,
  msUntilNextDay,
  slotCount,
  slotIndex,
  viennaClock,
  viennaDateKey,
  viennaDayStart,
  viennaTime,
  weekKeys,
  weekRange,
  weekRangeLabel,
} from '../src/time';

const iso = (d: Date) => d.toISOString();

describe('time', () => {
  it('Normaltag', () => {
    const at = new Date('2026-10-07T12:00:00Z');
    const r = dayRange(at);
    expect(r.key).toBe('2026-10-07');
    expect(iso(r.start)).toBe('2026-10-06T22:00:00.000Z');
    expect(iso(r.end)).toBe('2026-10-07T22:00:00.000Z');
    expect(slotCount('2026-10-07')).toBe(288);
  });

  it('Wintertag', () => {
    expect(iso(viennaDayStart('2026-01-15'))).toBe('2026-01-14T23:00:00.000Z');
  });

  it('Umstellung Frühling', () => {
    expect(iso(viennaDayStart('2026-03-29'))).toBe('2026-03-28T23:00:00.000Z');
    expect(iso(viennaDayStart('2026-03-30'))).toBe('2026-03-29T22:00:00.000Z');
    expect(slotCount('2026-03-29')).toBe(276);
  });

  it('Umstellung Herbst', () => {
    expect(iso(viennaDayStart('2026-10-25'))).toBe('2026-10-24T22:00:00.000Z');
    expect(iso(viennaDayStart('2026-10-26'))).toBe('2026-10-25T23:00:00.000Z');
    expect(slotCount('2026-10-25')).toBe(300);
  });

  it('00:10 Uhr Wien (Sommer)', () => {
    const at = new Date('2026-10-06T22:10:00Z');
    expect(viennaDateKey(at)).toBe('2026-10-07');
    expect(slotIndex(at, dayRange(at).start)).toBe(2);
    expect(viennaDateKey(new Date('2026-10-06T21:50:00Z'))).toBe('2026-10-06');
  });

  it('00:10 Uhr Wien (Winter)', () => {
    expect(viennaDateKey(new Date('2026-01-14T23:10:00Z'))).toBe('2026-01-15');
  });

  it('Woche', () => {
    const at = new Date('2026-10-07T12:00:00Z');
    const keys = [
      '2026-10-01',
      '2026-10-02',
      '2026-10-03',
      '2026-10-04',
      '2026-10-05',
      '2026-10-06',
      '2026-10-07',
    ];
    expect(weekKeys(at)).toEqual(keys);
    const r = weekRange(at);
    expect(iso(r.start)).toBe('2026-09-30T22:00:00.000Z');
    expect(iso(r.end)).toBe('2026-10-07T22:00:00.000Z');
    expect(weekRangeLabel(keys)).toBe('01.10. – 07.10.2026');
  });

  it('Woche über Monats- und Jahresgrenze', () => {
    const w = weekKeys(new Date('2026-03-31T10:00:00Z'));
    expect(w[0]).toBe('2026-03-25');
    expect(w).toHaveLength(7);
    expect(weekKeys(new Date('2026-01-02T10:00:00Z'))[0]).toBe('2025-12-27');
  });

  it('addDays', () => {
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('Uhrzeit', () => {
    expect(viennaTime(new Date('2026-10-07T08:05:09Z'))).toBe('10:05');
    expect(viennaClock(new Date('2026-10-07T08:05:09Z'))).toBe('10:05:09');
    expect(viennaTime(new Date('2026-10-06T22:00:00Z'))).toBe('00:00');
  });

  it('dayLabel', () => {
    expect(dayLabel('2026-10-07')).toBe('07 Okt');
    expect(dayLabel('2026-03-01')).toBe('01 Mär');
  });

  it('msUntilNextDay', () => {
    expect(msUntilNextDay(new Date('2026-10-07T21:59:00Z'))).toBe(60000);
    expect(msUntilNextDay(new Date('2026-10-06T22:00:00Z'))).toBe(86400000);
  });

  it('slotIndex am Tagesende', () => {
    expect(
      slotIndex(new Date('2026-10-07T21:59:59Z'), new Date('2026-10-06T22:00:00Z')),
    ).toBe(287);
  });
});
