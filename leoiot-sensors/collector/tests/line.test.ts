import { describe, expect, it } from 'vitest';
import { createTimestamps, escapeTag, toLine } from '../src/line.js';
import { nili3 } from './helpers.js';

const [device] = nili3();

describe('Readings are stored as the contract specifies (line protocol)', () => {
  it('writes one point per value with the mapping tags and one float field', () => {
    expect(toLine(device!, 'temperature', 22.4, 1_790_000_000_123_000_000n)).toBe(
      'room_climate,device=nili3,room=105,source=sensor temperature=22.4 1790000000123000000',
    );
    expect(toLine(device!, 'co2', 868, 5n)).toBe('room_climate,device=nili3,room=105,source=sensor co2=868 5');
    expect(toLine(device!, 'humidity', 47.25, 5n)).toBe('room_climate,device=nili3,room=105,source=sensor humidity=47.25 5');
  });

  it('never writes an integer suffix, so every field stays a float', () => {
    expect(toLine(device!, 'co2', 868, 5n)).not.toMatch(/co2=868i/);
  });

  it('escapes commas, equals signs and spaces in tag values', () => {
    expect(escapeTag('a b,c=d')).toBe('a\\ b\\,c\\=d');
    expect(toLine({ ...device!, device: 'my dev,ice=1' }, 'co2', 1, 1n)).toBe(
      'room_climate,device=my\\ dev\\,ice\\=1,room=105,source=sensor co2=1 1',
    );
  });

  it('turns the receipt time in ms into ns', () => {
    const ns = createTimestamps();
    expect(ns(1_790_000_000_123)).toBe(1_790_000_000_123_000_000n);
  });

  it('Two quantities at nearly the same time: equal receipt times still give distinct timestamps', () => {
    const ns = createTimestamps();
    const first = ns(1000);
    const second = ns(1000);
    const third = ns(1000);
    expect(first).toBe(1_000_000_000n);
    expect(second).toBe(1_000_000_001n);
    expect(third).toBe(1_000_000_002n);
    // The next millisecond is untouched again.
    expect(ns(1001)).toBe(1_001_000_000n);
  });
});
