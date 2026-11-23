// The room list: what is known about every room that sends, from the retained live messages of
// `leoiot/room-climate/#` (or, while the live channel is down, from the stored readings). No DOM here.
import type { Air } from './air';
import type { CsvRecord } from './csv';
import { floorOf, groupByFloor, type FloorGroup, type FloorId } from './floors';
import { parseLiveMessage } from './live';
import { isValidRoomId } from './room';
import { EMPTY_SNAPSHOT, mergeSnapshots, parseLatest, snapshotOfLive, type Snapshot } from './snapshot';
import { deriveRoomView } from './view';

export type RoomListState = Map<string, Snapshot>;

const PREFIX = 'leoiot/room-climate/';

/** The room of a room topic: one level after the prefix, and a valid room id; otherwise null. */
export function roomOfTopic(topic: string): string | null {
  if (!topic.startsWith(PREFIX)) return null;
  const room = topic.slice(PREFIX.length);
  return isValidRoomId(room) ? room : null; // a valid id has no "/", so extra levels fail here
}

/**
 * Applies one message. An empty payload is the broker's way of saying a retained message was
 * cleared: the room is removed. Anything unusable is ignored. Returns the same map, changed.
 */
export function applyRoomMessage(state: RoomListState, topic: string, payload: Uint8Array | string): RoomListState {
  const room = roomOfTopic(topic);
  if (room === null) return state;
  if (payload.length === 0) {
    state.delete(room);
    return state;
  }
  const reading = parseLiveMessage(payload, room);
  if (!reading) return state;
  state.set(room, mergeSnapshots(state.get(room) ?? EMPTY_SNAPSHOT, snapshotOfLive(reading)));
  return state;
}

/** Stored readings of all rooms (the fallback): grouped by their `room` column, merged into the state. */
export function applyStoredRooms(state: RoomListState, records: readonly CsvRecord[]): RoomListState {
  const byRoom = new Map<string, CsvRecord[]>();
  for (const r of records) {
    const room = r.room ?? '';
    if (!isValidRoomId(room)) continue;
    byRoom.set(room, [...(byRoom.get(room) ?? []), r]);
  }
  for (const [room, rows] of byRoom) {
    const snapshot = parseLatest(rows);
    if (snapshot.at !== null) state.set(room, mergeSnapshots(state.get(room) ?? EMPTY_SNAPSHOT, snapshot));
  }
  return state;
}

export interface RoomEntry {
  room: string;
  floor: FloorId | null;
  state: 'live' | 'stale';
  air: Air | null;
  co2: number | null;
  simulated: boolean;
  lastAt: number;
}

export interface FloorEntries {
  floor: FloorId | null;
  rooms: RoomEntry[];
}

/** One entry per room by the room page's rules (five-minute age, limits 800/1000, unknown values null). */
export function listEntries(state: ReadonlyMap<string, Snapshot>, now: number): FloorEntries[] {
  const entries = new Map<string, RoomEntry>();
  for (const [room, snapshot] of state) {
    if (snapshot.at === null) continue;
    const view = deriveRoomView({ snapshot, series24h: null, now, status: 'ok' });
    if (view.state !== 'live' && view.state !== 'stale') continue;
    entries.set(room, {
      room,
      floor: floorOf(room),
      state: view.state,
      air: view.air,
      co2: view.values.co2,
      simulated: view.source === 'simulated',
      lastAt: snapshot.at,
    });
  }
  return groupByFloor([...entries.keys()]).map((g: FloorGroup) => ({ floor: g.floor, rooms: g.rooms.map((id) => entries.get(id) as RoomEntry) }));
}

export interface Counts {
  rooms: number;
  /** Live rooms with CO₂ above the upper limit ("Jetzt lüften"). */
  bad: number;
  /** Live rooms between the limits ("Bald lüften"). */
  soon: number;
  /** Rooms whose newest reading is outdated. */
  stale: number;
}

export interface ListSummary {
  total: Counts;
  floors: { floor: FloorId | null; counts: Counts }[];
}

function countsOf(rooms: readonly RoomEntry[]): Counts {
  const c: Counts = { rooms: rooms.length, bad: 0, soon: 0, stale: 0 };
  for (const r of rooms) {
    if (r.state === 'stale') c.stale++;
    else if (r.air === 'bad') c.bad++;
    else if (r.air === 'soon') c.soon++;
  }
  return c;
}

/** Room counts for the whole list and per floor; bad and soon count live rooms only, stale the outdated ones. */
export function summarise(entries: readonly FloorEntries[]): ListSummary {
  return {
    total: countsOf(entries.flatMap((g) => g.rooms)),
    floors: entries.map((g) => ({ floor: g.floor, counts: countsOf(g.rooms) })),
  };
}
