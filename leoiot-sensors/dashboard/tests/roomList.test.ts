import { describe, expect, it } from 'vitest';
import { parseAnnotatedCsv } from '../src/core/csv';
import { applyRoomMessage, applyStoredRooms, listEntries, roomOfTopic, type RoomListState } from '../src/core/roomList';
import { roomsLatestQuery } from '../src/core/flux';
import { fixture } from './helpers';

const NOW = Date.parse('2026-11-03T06:36:30Z');
const T = (room: string) => `leoiot/room-climate/${room}`;
const msg = (room: string, extra: Record<string, unknown> = {}, ts = NOW - 60_000) => JSON.stringify({ room, device: 'nili3', source: 'sensor', ts, ...extra });
const rooms = (state: RoomListState) => listEntries(state, NOW).map((g) => [g.floor, g.rooms.map((r) => r.room)]);

describe('topic of a room', () => {
  it('one level after the prefix, a valid room id', () => {
    expect(roomOfTopic(T('E10'))).toBe('E10');
    expect(roomOfTopic(T('U74.1'))).toBe('U74.1');
    expect(roomOfTopic(T('a/b'))).toBeNull();
    expect(roomOfTopic(T('a+b'))).toBeNull();
    expect(roomOfTopic(T(''))).toBeNull();
    expect(roomOfTopic('leoiot/room-climate')).toBeNull();
    expect(roomOfTopic('other/room-climate/105')).toBeNull();
  });
});

describe('room list from live messages', () => {
  it('groups rooms by floor', () => {
    const s: RoomListState = new Map();
    for (const r of ['E10', '105', '1Aula']) applyRoomMessage(s, T(r), msg(r, { co2: 600 }));
    expect(rooms(s)).toEqual([['E', ['E10']], ['1', ['1Aula', '105']]]);
  });
  it('accepts a Uint8Array payload', () => {
    const s: RoomListState = new Map();
    applyRoomMessage(s, T('105'), new TextEncoder().encode(msg('105', { co2: 600 })));
    expect(rooms(s)).toEqual([['1', ['105']]]);
  });
  it('an empty payload (cleared retained message) removes the room', () => {
    const s: RoomListState = new Map();
    applyRoomMessage(s, T('105'), msg('105', { co2: 600 }));
    applyRoomMessage(s, T('105'), new Uint8Array(0));
    expect(rooms(s)).toEqual([]);
  });
  it('ignores a topic with an invalid id or extra levels, and a room field that differs from the topic', () => {
    const s: RoomListState = new Map();
    applyRoomMessage(s, T('a+b'), msg('a+b'));
    applyRoomMessage(s, T('105/extra'), msg('105'));
    applyRoomMessage(s, T('105'), msg('106'));
    applyRoomMessage(s, T('105'), 'not json');
    expect(rooms(s)).toEqual([]);
  });
  it('the newer value of a quantity wins', () => {
    const s: RoomListState = new Map();
    applyRoomMessage(s, T('105'), msg('105', { co2: 900 }, NOW - 10_000));
    applyRoomMessage(s, T('105'), msg('105', { co2: 500 }, NOW - 50_000));
    expect(listEntries(s, NOW)[0].rooms[0].co2).toBe(900);
    applyRoomMessage(s, T('105'), msg('105', { co2: 500 }, NOW - 5_000));
    expect(listEntries(s, NOW)[0].rooms[0].co2).toBe(500);
  });
  it('a message two hours old is outdated, with no air state', () => {
    const s: RoomListState = new Map();
    applyRoomMessage(s, T('107'), msg('107', { co2: 1500 }, NOW - 2 * 3600_000));
    expect(listEntries(s, NOW)[0].rooms[0]).toMatchObject({ room: '107', state: 'stale', air: null });
  });
  it('CO2 1120 fresh is red; a fresh message without CO2 has no air state', () => {
    const s: RoomListState = new Map();
    applyRoomMessage(s, T('105'), msg('105', { co2: 1120, temperature: 21 }));
    applyRoomMessage(s, T('106'), msg('106', { temperature: 21 }));
    const [one] = listEntries(s, NOW);
    expect(one.rooms[0]).toMatchObject({ room: '105', state: 'live', air: 'bad', co2: 1120 });
    expect(one.rooms[1]).toMatchObject({ room: '106', state: 'live', air: null, co2: null });
  });
  it('flags simulated rooms', () => {
    const s: RoomListState = new Map();
    applyRoomMessage(s, T('E10'), msg('E10', { co2: 600, source: 'simulated' }));
    expect(listEntries(s, NOW)[0].rooms[0].simulated).toBe(true);
  });
});

describe('room list from stored readings (fallback)', () => {
  it('the query asks for every room over 30 days and keeps the room column', () => {
    const q = roomsLatestQuery();
    expect(q).toContain('range(start: -30d)');
    expect(q).toContain('r._measurement == "room_climate"');
    expect(q).not.toContain('r.room ==');
    expect(q).toContain('|> last()');
    expect(q).toContain('"room"');
  });
  it('groups the records by room, skips invalid ids', () => {
    const s: RoomListState = new Map();
    applyStoredRooms(s, parseAnnotatedCsv(fixture('latestRooms.csv')));
    expect(rooms(s)).toEqual([['E', ['E10']], ['1', ['105']]]);
    const entries = listEntries(s, NOW);
    expect(entries[0].rooms[0]).toMatchObject({ simulated: true, co2: 713, air: 'good' });
    expect(entries[1].rooms[0]).toMatchObject({ simulated: false, co2: 1070, air: 'bad' });
  });
});
