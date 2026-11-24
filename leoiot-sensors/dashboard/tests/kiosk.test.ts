import { describe, expect, it } from 'vitest';
import { attention, fitAttention, isKioskSearch, kioskPages, kioskParams, nextReloadAt, tileGrid } from '../src/core/kiosk';
import type { FloorEntries, RoomEntry } from '../src/core/roomList';

const room = (id: string, co2: number | null, extra: Partial<RoomEntry> = {}): RoomEntry => ({
  room: id,
  floor: ['U', 'E', '1', '2', 'T'].includes(id[0]) ? (id[0] as RoomEntry['floor']) : null,
  state: 'live',
  air: co2 === null ? null : co2 > 1000 ? 'bad' : co2 > 800 ? 'soon' : 'good',
  co2,
  simulated: false,
  lastAt: 0,
  ...extra,
});
const floor = (f: FloorEntries['floor'], n: number): FloorEntries => ({ floor: f, rooms: Array.from({ length: n }, (_, i) => room(`${f}${String(i).padStart(2, '0')}`, 500)) });

describe('tileGrid', () => {
  it('fits tiles of at least 220 x 120 with the gap between them', () => {
    expect(tileGrid(1380, 740, 1, 16)).toEqual({ cols: 5, rows: 5 });
    expect(tileGrid(1380, 740)).toEqual({ cols: 6, rows: 6 });
  });
  it('scales the minimum tile with the screen', () => {
    expect(tileGrid(690, 370, 0.5, 8)).toEqual(tileGrid(1380, 740, 1, 16));
    expect(tileGrid(2760, 1480, 2, 32)).toEqual(tileGrid(1380, 740, 1, 16));
  });
  it('is never below one tile', () => {
    expect(tileGrid(0, 0, 1, 16)).toEqual({ cols: 1, rows: 1 });
    expect(tileGrid(100, 50)).toEqual({ cols: 1, rows: 1 });
  });
});

describe('kioskPages', () => {
  it('one page per floor, in the order given', () => {
    const pages = kioskPages([floor('E', 3), floor('1', 24), floor('2', 1)], 24);
    expect(pages.map((p) => [p.floor, p.part, p.parts, p.rooms.length])).toEqual([['E', 1, 1, 3], ['1', 1, 1, 24], ['2', 1, 1, 1]]);
  });
  it('splits a floor that does not fit into near-equal parts: 29 rooms with 24 per page are 15 and 14', () => {
    const pages = kioskPages([floor('1', 29)], 24);
    expect(pages.map((p) => [p.part, p.parts, p.rooms.length])).toEqual([[1, 2, 15], [2, 2, 14]]);
    expect(pages.flatMap((p) => p.rooms.map((r) => r.room))).toEqual(floor('1', 29).rooms.map((r) => r.room)); // order kept, none lost
  });
  it('three parts when needed, never 28 and 1', () => {
    expect(kioskPages([floor('1', 50)], 24).map((p) => p.rooms.length)).toEqual([17, 17, 16]);
    expect(kioskPages([floor('1', 25)], 24).map((p) => p.rooms.length)).toEqual([13, 12]);
  });
  it('no rooms, no pages; a page size below one counts as one', () => {
    expect(kioskPages([], 24)).toEqual([]);
    expect(kioskPages([{ floor: 'E', rooms: [] }], 24)).toEqual([]);
    expect(kioskPages([floor('E', 2)], 0).map((p) => p.rooms.length)).toEqual([1, 1]);
  });
});

describe('attention', () => {
  it('bad and soon, highest CO2 first, live rooms only', () => {
    const entries: FloorEntries[] = [
      { floor: 'E', rooms: [room('E10', 1100), room('E11', 900), room('E12', 500), room('E13', 1500, { state: 'stale', air: null })] },
      { floor: '1', rooms: [room('101', 1300), room('102', 850), room('103', null)] },
    ];
    const a = attention(entries);
    expect(a.bad.map((r) => r.room)).toEqual(['101', 'E10']);
    expect(a.soon.map((r) => r.room)).toEqual(['E11', '102']);
  });
  it('equal values keep the room order; nothing to air gives empty lists', () => {
    expect(attention([{ floor: '1', rooms: [room('102', 1100), room('101', 1100)] }]).bad.map((r) => r.room)).toEqual(['101', '102']);
    expect(attention([floor('E', 3)])).toEqual({ bad: [], soon: [] });
    expect(attention([])).toEqual({ bad: [], soon: [] });
  });
});

describe('fitAttention', () => {
  const many = (n: number, co2: number) => Array.from({ length: n }, (_, i) => room(`1${i}`, co2));
  it('shows everything that fits, headings counted as lines', () => {
    const a = { bad: many(2, 1100), soon: many(3, 900) };
    expect(fitAttention(a, 7)).toEqual({ ...a, more: 0 });
  });
  it('leaves a line for "+ N more" and drops a heading without rooms', () => {
    const a = { bad: many(4, 1100), soon: many(3, 900) };
    const v = fitAttention(a, 6);
    expect(v.bad).toHaveLength(4);
    expect(v.soon).toHaveLength(0);
    expect(v.more).toBe(3);
    const w = fitAttention(a, 8);
    expect([w.bad.length, w.soon.length, w.more]).toEqual([4, 1, 2]);
  });
  it('a tiny space shows only the count', () => {
    const v = fitAttention({ bad: many(2, 1100), soon: [] }, 2);
    expect([v.bad.length, v.soon.length, v.more]).toEqual([0, 0, 2]);
  });
});

describe('kioskParams', () => {
  it('defaults: all floors, German, dark, 15 seconds', () => {
    expect(kioskParams('?kiosk')).toEqual({ floor: 'all', lang: 'de', theme: 'dark', seconds: 15 });
    expect(kioskParams('')).toEqual({ floor: 'all', lang: 'de', theme: 'dark', seconds: 15 });
  });
  it('reads floor, lang, theme and seconds', () => {
    expect(kioskParams('?kiosk&floor=1&lang=en&theme=light&seconds=30')).toEqual({ floor: '1', lang: 'en', theme: 'light', seconds: 30 });
    expect(kioskParams('?kiosk&floor=E').floor).toBe('E');
  });
  it('unknown values mean the default', () => {
    expect(kioskParams('?floor=9&lang=fr&theme=blue&seconds=abc')).toEqual({ floor: 'all', lang: 'de', theme: 'dark', seconds: 15 });
    expect(kioskParams('?seconds=').seconds).toBe(15);
  });
  it('clamps the page time to 5 to 120 seconds', () => {
    expect(kioskParams('?seconds=1').seconds).toBe(5);
    expect(kioskParams('?seconds=0').seconds).toBe(5);
    expect(kioskParams('?seconds=-20').seconds).toBe(5);
    expect(kioskParams('?seconds=500').seconds).toBe(120);
    expect(kioskParams('?seconds=5').seconds).toBe(5);
    expect(kioskParams('?seconds=120').seconds).toBe(120);
    expect(kioskParams('?seconds=7.6').seconds).toBe(8);
  });
});

describe('isKioskSearch', () => {
  it('kiosk with any value or none', () => {
    expect(isKioskSearch('?kiosk')).toBe(true);
    expect(isKioskSearch('?kiosk=')).toBe(true);
    expect(isKioskSearch('?kiosk=1&floor=E')).toBe(true);
    expect(isKioskSearch('?floor=E')).toBe(false);
    expect(isKioskSearch('')).toBe(false);
  });
});

describe('nextReloadAt', () => {
  it('is 03:30 school time: 02:30 UTC in winter, 01:30 UTC in summer', () => {
    expect(nextReloadAt(Date.parse('2026-11-03T06:36:30Z'))).toBe(Date.parse('2026-11-04T02:30:00Z'));
    expect(nextReloadAt(Date.parse('2026-07-03T12:00:00Z'))).toBe(Date.parse('2026-07-04T01:30:00Z'));
  });
  it('before 03:30 it is the same night, at exactly 03:30 the next one', () => {
    expect(nextReloadAt(Date.parse('2026-11-04T01:00:00Z'))).toBe(Date.parse('2026-11-04T02:30:00Z'));
    expect(nextReloadAt(Date.parse('2026-11-04T02:30:00Z'))).toBe(Date.parse('2026-11-05T02:30:00Z'));
  });
  it('follows the clock change', () => {
    // 2026-10-25: summer time ends at 03:00 (second 02:xx hour), 03:30 is already winter time (UTC+1).
    expect(nextReloadAt(Date.parse('2026-10-24T12:00:00Z'))).toBe(Date.parse('2026-10-25T02:30:00Z'));
    // 2026-03-29: summer time starts at 02:00, 03:30 is summer time (UTC+2).
    expect(nextReloadAt(Date.parse('2026-03-28T12:00:00Z'))).toBe(Date.parse('2026-03-29T01:30:00Z'));
  });
});
