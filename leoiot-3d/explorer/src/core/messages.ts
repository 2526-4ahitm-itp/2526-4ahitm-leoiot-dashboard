// Reading room-climate live messages (spec model3d/room-climate-view,
// "Messages are read as the contract specifies"; shape: platform/data-contract).

export const ROOM_TOPIC_PREFIX = 'leoiot/room-climate/';
export const ROOM_TOPIC_FILTER = ROOM_TOPIC_PREFIX + '#';

export interface Reading {
  room: string;
  ts: number;
  co2?: number;
  temperature?: number;
}

/** What a message means for its room. */
export type Parsed = { kind: 'reading'; reading: Reading } | { kind: 'clear'; room: string } | { kind: 'invalid' };

function finite(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

export function parseMessage(topic: string, payload: string): Parsed {
  if (!topic.startsWith(ROOM_TOPIC_PREFIX)) return { kind: 'invalid' };
  const room = topic.slice(ROOM_TOPIC_PREFIX.length);
  if (!room || room.includes('/')) return { kind: 'invalid' };
  // An empty retained message removes the room's message from the broker
  if (payload.length === 0) return { kind: 'clear', room };

  let data: unknown;
  try {
    data = JSON.parse(payload);
  } catch {
    return { kind: 'invalid' };
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return { kind: 'invalid' };
  const m = data as Record<string, unknown>;
  const ts = finite(m.ts);
  if (ts === undefined || m.room !== room) return { kind: 'invalid' };

  const reading: Reading = { room, ts };
  const co2 = finite(m.co2);
  const temperature = finite(m.temperature);
  if (co2 !== undefined) reading.co2 = co2;
  if (temperature !== undefined) reading.temperature = temperature;
  return { kind: 'reading', reading };
}
