// The room's live message (platform/data-contract: "Room-climate live data is
// published per room"). The latest value of every quantity a device delivered
// since the collector started is kept in memory.
import type { Device, Quantity } from './devices.js';

export const LIVE_TOPIC_PREFIX = 'leoiot/room-climate/';

export interface LiveMessage {
  topic: string;
  payload: string;
}

export function createLiveState() {
  const latest = new Map<string, Partial<Record<Quantity, number>>>();

  return {
    /** Records the value and returns the message to publish: all known values, the time of this one. */
    update(device: Device, quantity: Quantity, value: number, receivedMs: number): LiveMessage {
      const values = latest.get(device.device) ?? {};
      values[quantity] = value;
      latest.set(device.device, values);
      const message: Record<string, unknown> = {
        room: device.room,
        device: device.device,
        source: device.source,
        ts: receivedMs,
      };
      for (const q of ['co2', 'temperature', 'humidity'] as const) {
        const v = values[q];
        if (v !== undefined) message[q] = v;
      }
      return { topic: `${LIVE_TOPIC_PREFIX}${device.room}`, payload: JSON.stringify(message) };
    },
  };
}
