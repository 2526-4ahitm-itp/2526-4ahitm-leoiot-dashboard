import { describe, expect, it } from 'vitest';
import { RoomStore } from '../src/core/store';

const T = 'leoiot/room-climate/';
const msg = (room: string, ts: number, extra: object = {}) => JSON.stringify({ room, ts, ...extra });

describe('RoomStore', () => {
  it('keeps the newest message by ts', () => {
    const s = new RoomStore();
    s.apply(T + '105', msg('105', 30_000, { co2: 900 }));
    expect(s.apply(T + '105', msg('105', 0, { co2: 500 }))).toBeNull();
    expect(s.get('105')?.co2).toBe(900);
    s.apply(T + '105', msg('105', 60_000, { co2: 1000 }));
    expect(s.get('105')?.co2).toBe(1000);
  });

  it('a newer message replaces all fields, without merging', () => {
    const s = new RoomStore();
    s.apply(T + '105', msg('105', 1, { co2: 900, temperature: 21 }));
    s.apply(T + '105', msg('105', 2, { co2: 950 }));
    expect(s.get('105')).toEqual({ room: '105', ts: 2, co2: 950 });
  });

  it('a broken message keeps the previous values', () => {
    const s = new RoomStore();
    s.apply(T + '105', msg('105', 1, { co2: 900 }));
    expect(s.apply(T + '105', '{bad')).toBeNull();
    expect(s.get('105')?.co2).toBe(900);
  });

  it('an empty retained message removes the room', () => {
    const s = new RoomStore();
    s.apply(T + '105', msg('105', 1, { co2: 900 }));
    expect(s.apply(T + '105', '')).toBe('105');
    expect(s.get('105')).toBeUndefined();
  });

  it('notifies listeners of changed rooms only', () => {
    const s = new RoomStore();
    const seen: string[] = [];
    const off = s.subscribe((r) => seen.push(r));
    s.apply(T + '105', msg('105', 2, { co2: 1 }));
    s.apply(T + '105', msg('105', 1, { co2: 2 }));
    s.apply(T + 'E10', '');
    off();
    s.apply(T + 'E10', msg('E10', 1, { co2: 1 }));
    expect(seen).toEqual(['105']);
  });
});
