// InfluxDB line protocol for measurement room_climate (platform/data-contract:
// "Room-climate readings are stored as room_climate").
import type { Device, Quantity } from './devices.js';

/** Tag values: backslash-escape comma, equals sign and space. */
export function escapeTag(value: string): string {
  return value.replace(/[,= ]/g, (c) => `\\${c}`);
}

/** One point with one field; floats are written without the integer suffix. */
export function toLine(device: Device, quantity: Quantity, value: number, timestampNs: bigint): string {
  // Tags in key order (device, room, source), as InfluxDB recommends.
  return (
    `room_climate,device=${escapeTag(device.device)},room=${escapeTag(device.room)},` +
    `source=${escapeTag(device.source)} ${quantity}=${value} ${timestampNs}`
  );
}

/**
 * Receipt time (ms) as a nanosecond timestamp. Every point gets its own
 * timestamp: when two values arrive in the same millisecond the later one is
 * moved by a few nanoseconds, so that InfluxDB keeps one point per value.
 */
export function createTimestamps() {
  let last = 0n;
  return (receivedMs: number): bigint => {
    let ns = BigInt(Math.trunc(receivedMs)) * 1_000_000n;
    if (ns <= last) ns = last + 1n;
    last = ns;
    return ns;
  };
}
