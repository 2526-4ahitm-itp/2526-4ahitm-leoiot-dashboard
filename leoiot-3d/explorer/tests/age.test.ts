import { describe, expect, it } from 'vitest';
import { freshness, STALE_AFTER_MS } from '../src/core/age';

describe('freshness', () => {
  const now = 1_800_000_000_000;
  it('exactly five minutes is current', () => expect(freshness(now - STALE_AFTER_MS, now)).toBe('current'));
  it('one millisecond more is stale', () => expect(freshness(now - STALE_AFTER_MS - 1, now)).toBe('stale'));
  it('4 min 50 s is current', () => expect(freshness(now - 290_000, now)).toBe('current'));
  it('12 minutes is stale', () => expect(freshness(now - 12 * 60_000, now)).toBe('stale'));
  it('a ts in the future is current', () => expect(freshness(now + 60_000, now)).toBe('current'));
});
