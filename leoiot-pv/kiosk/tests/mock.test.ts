import { describe, expect, it } from 'vitest';
import { parseToday, parseWeek } from '@leoiot-pv/shared/influx';
import { parseLiveMessage } from '@leoiot-pv/shared/live';
import { mockCountersMessage, mockPowerMessage, mockTodayCsv, mockWeekCsv } from '../dev/mockData';

const TARGET = { yield: 746.2, exported: 0, imported: 207, charged: 82.4, discharged: 141.2 };
const start = new Date('2026-10-06T22:00:00Z');
const until = new Date('2026-10-07T12:03:00Z');

describe('Beispieldaten', () => {
  it('Tagesabfrage: 169 Stände, endet beim Zielstand, nie fallend', () => {
    const rows = parseToday(mockTodayCsv(start, until));
    expect(rows).toHaveLength(169);
    expect(rows[rows.length - 1].t).toBe(until.getTime());
    expect(rows[rows.length - 1].counters).toEqual(TARGET);
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i].t).toBeGreaterThan(rows[i - 1].t);
      for (const k of Object.keys(TARGET) as (keyof typeof TARGET)[]) {
        expect(rows[i].counters[k]).toBeGreaterThanOrEqual(rows[i - 1].counters[k]);
      }
    }
  });

  it('Tagesabfrage ohne Zeitraum ist leer', () => {
    expect(mockTodayCsv(start, start)).toBe('\r\n');
    expect(parseToday('\r\n')).toEqual([]);
  });

  it('Wochenabfrage: sieben Tage, heute ist der Zielstand', () => {
    const days = Array.from({ length: 7 }, (_, i) => new Date(start.getTime() + (i - 6) * 86_400_000));
    const week = parseWeek(mockWeekCsv(days, until));
    expect(Object.keys(week).sort()).toEqual([
      '2026-10-01',
      '2026-10-02',
      '2026-10-03',
      '2026-10-04',
      '2026-10-05',
      '2026-10-06',
      '2026-10-07',
    ]);
    expect(week['2026-10-07']).toEqual(TARGET);
    expect(week['2026-10-01'].yield).toBe(612.4);
  });

  it('Leistungsnachricht ist lesbar und stimmig', () => {
    const msg = parseLiveMessage(mockPowerMessage(new Date('2026-10-07T10:00:00Z'), start), 0);
    expect(msg?.kind).toBe('power');
    if (msg?.kind !== 'power') return;
    expect(msg.power.pv).toBeGreaterThan(0);
    expect(msg.power.grid).toBeCloseTo(msg.power.load - msg.power.pv - msg.power.battery, 1);
    const night = parseLiveMessage(mockPowerMessage(new Date('2026-10-07T00:00:00Z'), start), 0);
    if (night?.kind !== 'power') throw new Error('keine Leistung');
    expect(night.power.pv).toBe(0);
    expect(night.power.battery).toBe(10);
  });

  it('Zählernachricht trägt den Zielstand', () => {
    const msg = parseLiveMessage(mockCountersMessage(until, start), 0);
    expect(msg?.kind).toBe('counters');
    if (msg?.kind !== 'counters') return;
    expect(msg.counters).toEqual(TARGET);
    expect(msg.t).toBe(until.getTime());
  });
});
