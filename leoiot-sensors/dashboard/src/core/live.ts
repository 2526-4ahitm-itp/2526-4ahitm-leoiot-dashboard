// Live messages of the contract: `leoiot/room-climate/<room>`, a JSON object, retained.
import { isSource } from './flux';
import { assertRoomId } from './room';
import { QUANTITIES, type LiveReading } from './snapshot';

export function liveTopic(room: string): string {
  return `leoiot/room-climate/${assertRoomId(room)}`;
}

/** Address of the browser endpoint of the broker (MQTT over WebSocket), matching the page's protocol. */
export function liveUrl(loc: { protocol: string; host: string }): string {
  return `${loc.protocol === 'https:' ? 'wss' : 'ws'}://${loc.host}/mqtt`;
}

/**
 * Reads a live message. Unknown fields are ignored; a message for another room, without a usable
 * `ts` or `source`, or that is not a JSON object is dropped (null). A quantity that is not a number
 * is treated as not delivered, never as zero.
 */
export function parseLiveMessage(payload: string | Uint8Array, room: string): LiveReading | null {
  let data: unknown;
  try {
    data = JSON.parse(typeof payload === 'string' ? payload : new TextDecoder().decode(payload));
  } catch {
    return null;
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return null;
  const o = data as Record<string, unknown>;
  if (o.room !== room) return null;
  if (typeof o.ts !== 'number' || !Number.isFinite(o.ts) || !isSource(o.source)) return null;
  const reading: LiveReading = { room, device: typeof o.device === 'string' ? o.device : '', source: o.source, ts: o.ts };
  for (const q of QUANTITIES) {
    const v = o[q];
    if (typeof v === 'number' && Number.isFinite(v)) reading[q] = v;
  }
  return reading;
}
