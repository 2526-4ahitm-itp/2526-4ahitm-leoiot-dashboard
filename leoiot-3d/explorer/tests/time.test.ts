import { describe, expect, it } from 'vitest';
import { readingTime } from '../src/core/time';

describe('readingTime (Europe/Vienna)', () => {
  it('today shows the time only', () => {
    // 2026-10-30 13:05:22 in Vienna (CET, UTC+1)
    expect(readingTime(Date.UTC(2026, 9, 30, 12, 5, 22), Date.UTC(2026, 9, 30, 15, 0, 0))).toBe('13:05:22');
  });
  it('another day adds the date', () => {
    expect(readingTime(Date.UTC(2026, 9, 29, 22, 30, 0), Date.UTC(2026, 9, 30, 9, 0, 0))).toBe('2026-10-29 23:30:00');
  });
  it('day boundary is Vienna midnight, not UTC', () => {
    // 23:30 UTC on the 29th is already 00:30 on the 30th in Vienna
    expect(readingTime(Date.UTC(2026, 9, 29, 23, 30, 0), Date.UTC(2026, 9, 30, 9, 0, 0))).toBe('00:30:00');
  });
  it('summer time before the October change', () => {
    // 2026-10-24 12:00 UTC is 14:00 CEST
    expect(readingTime(Date.UTC(2026, 9, 24, 12, 0, 0), Date.UTC(2026, 9, 24, 13, 0, 0))).toBe('14:00:00');
  });
});
