import { describe, it, expect } from 'vitest';
import type { Counters, Power } from '@leoiot-pv/shared/energy';
import type { CounterRow } from '@leoiot-pv/shared/influx';
import { isStale, liveState } from '../src/core/live';

const power: Power = { pv: 62.4, load: 54.3, grid: 8.1, battery: 0 };
const counters = (y: number): Counters => ({ yield: y, exported: 0, imported: 0, charged: 0, discharged: 0 });
const MIN = 60_000;
const rows: CounterRow[] = [0, 5, 10].map((m) => ({ t: 1_000_000 + m * MIN, counters: counters(m * 2) }));

describe('liveState', () => {
  it('Nachricht von vor 30 s: Live', () => {
    const now = 5_000_000;
    expect(liveState({ power, t: now - 30_000 }, rows, now)).toEqual({ power, label: 'live' });
  });
  it('älter als zwei Minuten: Mittel der letzten zehn Minuten', () => {
    const now = 1_000_000 + 11 * MIN;
    const s = liveState({ power, t: now - 3 * MIN }, rows, now);
    expect(s?.label).toBe('avg10');
    expect(s?.power.pv).toBeCloseTo(120); // 20 kWh in 10 min
  });
  it('genau zwei Minuten zählen noch als live', () => {
    expect(liveState({ power, t: 0 }, [], 2 * MIN)?.label).toBe('live');
  });
  it('weder Live noch Zählerstände: nichts', () => {
    expect(liveState(null, [], 1)).toBeNull();
  });
});

describe('isStale', () => {
  it('fünf Minuten sind noch frisch, mehr nicht', () => {
    expect(isStale(0, 5 * MIN)).toBe(false);
    expect(isStale(0, 5 * MIN + 1)).toBe(true);
    expect(isStale(null, 0)).toBe(true);
  });
});
