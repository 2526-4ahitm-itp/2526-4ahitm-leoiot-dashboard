// DEMO, not a permanent part of the system: see README.md.
// The live message and the InfluxDB line of one generated reading, as
// platform/data-contract specifies them, marked as demo.

export const DEVICE = 'demo';
export const SOURCE = 'simulated';
export const TOPIC_PREFIX = 'leoiot/room-climate/';

/** Tag values: backslash-escape comma, equals sign and space. */
export function escapeTag(value) {
  return String(value).replace(/[,= ]/g, (c) => `\\${c}`);
}

/** The retained live message of a room. */
export function liveMessage(room, ts, r) {
  return { room, device: DEVICE, source: SOURCE, demo: true, ts, co2: r.co2, temperature: r.temperature, humidity: r.humidity };
}

/** The line-protocol line of a reading (floats: no integer suffix), timestamp in ms. */
export function lineFor(room, ts, r) {
  return (
    `room_climate,device=${DEVICE},room=${escapeTag(room)},source=${SOURCE} ` +
    `co2=${r.co2},temperature=${r.temperature},humidity=${r.humidity} ${ts}`
  );
}
