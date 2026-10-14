import { describe, expect, it } from 'vitest';
import { createCounterWatch, dayKey } from '../src/core/counters.js';
import { checkResult } from '../src/core/reading.js';
import { collectLog, sampleResult } from './helpers.js';

function reading(overrides: Record<string, unknown>) {
  const r = checkResult(sampleResult(overrides));
  if (!r.ok) throw new Error('unerwartet');
  return r.reading;
}

describe('Zähler niedriger als in der vorigen Lesung', () => {
  it('loggt Feldname und beide Werte und ändert den Wert nicht', () => {
    const { lines, log } = collectLog();
    const watch = createCounterWatch(log);
    watch.observe(reading({ dailyImported: 12.3 }), '2026-10-14');
    const lower = reading({ dailyImported: 11.9 });
    const steps = watch.observe(lower, '2026-10-14');
    expect(steps).toEqual([{ field: 'daily_imported', previous: 12.3, current: 11.9 }]);
    expect(lower.dailyImported).toBe(11.9);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('daily_imported');
    expect(lines[0]).toContain('12.3');
    expect(lines[0]).toContain('11.9');
  });

  it('meldet nichts bei steigenden oder gleichen Werten', () => {
    const { lines, log } = collectLog();
    const watch = createCounterWatch(log);
    watch.observe(reading({ dailyYield: 10 }), '2026-10-14');
    watch.observe(reading({ dailyYield: 10 }), '2026-10-14');
    watch.observe(reading({ dailyYield: 11 }), '2026-10-14');
    expect(lines).toHaveLength(0);
  });

  it('vergleicht nicht über den Tageswechsel hinweg', () => {
    const { lines, log } = collectLog();
    const watch = createCounterWatch(log);
    watch.observe(reading({ dailyYield: 30 }), '2026-10-14');
    watch.observe(reading({ dailyYield: 0.1 }), '2026-10-15');
    expect(lines).toHaveLength(0);
  });
});

describe('Tag der Lesung', () => {
  it('nimmt das Datum aus plantLocalTime', () => {
    expect(dayKey({ plantLocalTime: '2026-10-14 23:59:00' }, 0)).toBe('2026-10-14');
    expect(dayKey({ plantLocalTime: '2026/10/15 00:01:00' }, 0)).toBe('2026-10-15');
  });

  it('nimmt sonst die Wiener Ortszeit', () => {
    // 22:30 UTC am 14.10. ist 00:30 am 15.10. in Wien (Sommerzeit)
    expect(dayKey({}, Date.UTC(2026, 9, 14, 22, 30))).toBe('2026-10-15');
    expect(dayKey({ plantLocalTime: 'unlesbar' }, Date.UTC(2026, 9, 14, 12, 0))).toBe('2026-10-14');
  });
});
