// Where the room list gets its rooms: one subscription to every room topic, with the stored
// readings of the last 30 days as the fallback while the live channel is down (once a minute).
// Used by the room list view and by the room page (header choice and the "no data" list).
import { ROOMS_TOPIC } from '../core/live';
import { applyRoomMessage, applyStoredRooms, type RoomListState } from '../core/roomList';
import type { Query } from './api';
import { startFeed, type Feed, type FeedMode, type MqttLike, type Timers } from './feed';
import { loadRooms } from './load';

/** After the connection is up, retained messages arrive within moments; this long without one means "no rooms". */
export const READY_AFTER_MS = 2000;

export interface RoomsSourceOptions {
  connect: () => MqttLike | Promise<MqttLike>;
  query: Query;
  timers: Timers;
  /** Called after the state changed or the mode changed. */
  onChange: () => void;
  /** Called with every message, after the room list state took it in (the room page routes its own room). */
  onMessage?: (topic: string, payload: Uint8Array) => void;
  /** More work for each round of the fallback poll (the room page refreshes its own room). */
  extraPoll?: () => Promise<void>;
  /** The clock (default `Date.now`); the time of the last successful load of the stored readings. */
  now?: () => number;
}

export interface RoomsSource {
  state: RoomListState;
  /** True once something answered (a message, the stored readings, or the short wait after connecting). */
  ready(): boolean;
  mode(): FeedMode;
  /** The last load of the stored readings failed (cleared by the next success). */
  failed(): boolean;
  /** Time of the last successful load of the stored readings, or null. */
  lastLoadAt(): number | null;
  stop(): void;
}

export function startRoomsSource(o: RoomsSourceOptions): RoomsSource {
  const state: RoomListState = new Map();
  let ready = false;
  let mode: FeedMode = 'connecting';
  let waiting: unknown = null;
  let stopped = false;
  let failed = false;
  let lastLoadAt: number | null = null;
  const now = o.now ?? Date.now;
  const markReady = () => {
    if (ready || stopped) return;
    ready = true;
    o.onChange();
  };
  const feed: Feed = startFeed({
    topic: ROOMS_TOPIC,
    connect: o.connect,
    timers: o.timers,
    poll: async () => {
      try {
        applyStoredRooms(state, await loadRooms(o.query));
        failed = false;
        lastLoadAt = now();
      } catch {
        failed = true; // the next round tries again; the list keeps what it has
      }
      if (!stopped) {
        ready = true;
        o.onChange();
      }
      await o.extraPoll?.();
    },
    onMessage: (topic, payload) => {
      applyRoomMessage(state, topic, payload);
      ready = true;
      o.onMessage?.(topic, payload);
      o.onChange();
    },
    onMode: (next) => {
      mode = next;
      if (next === 'live' && waiting === null && !ready) waiting = o.timers.setTimeout(markReady, READY_AFTER_MS);
      o.onChange();
    },
  });
  return {
    state,
    ready: () => ready,
    mode: () => mode,
    failed: () => failed,
    lastLoadAt: () => lastLoadAt,
    stop() {
      stopped = true;
      feed.stop();
      if (waiting !== null) o.timers.clearTimeout(waiting);
    },
  };
}
