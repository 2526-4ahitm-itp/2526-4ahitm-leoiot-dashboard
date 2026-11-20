// DEMO, not a permanent part of the system: see README.md.
// Generates room-climate values for every room of the 3D model except rooms
// with a real sensor.
//
//   node index.mjs           backfill the history, then publish and write once a minute
//   node index.mjs --clear   remove the demo's retained messages and database points, then exit

import { randomBytes } from 'node:crypto';
import mqtt from 'mqtt';
import { demoRooms } from './rooms.mjs';
import { reading } from './model.mjs';
import { liveMessage, lineFor, TOPIC_PREFIX } from './messages.mjs';
import { writeLines, deleteDemo } from './influx.mjs';

const MINUTE_MS = 60_000;
const STEP_MS = 5 * MINUTE_MS;
const EXPIRY_S = 30 * 24 * 3600;

const env = process.env;
const missing = ['SENSORS_INFLUX_TOKEN', 'SENSORS_MQTT_USER', 'SENSORS_MQTT_PASSWORD'].filter((n) => !env[n]);
if (missing.length > 0) {
  console.error(`DEMO: missing required variable(s): ${missing.join(', ')}; see leoiot-sensors/demo/README.md`);
  process.exit(1);
}

const mqttUrl = env.SENSORS_MQTT_URL || 'mqtt://mosquitto:1883';
const influx = {
  url: env.SENSORS_INFLUX_URL || 'http://influxdb:8086',
  token: env.SENSORS_INFLUX_TOKEN,
  org: env.SENSORS_INFLUX_ORG || 'leoiot',
  bucket: env.SENSORS_INFLUX_BUCKET || 'server_data',
};
const skip = (env.DEMO_SKIP_ROOMS ?? '105').split(',').map((s) => s.trim()).filter(Boolean);
const backfillDays = Number(env.DEMO_BACKFILL_DAYS ?? 7);
const rooms = demoRooms(skip);
const clearMode = process.argv.includes('--clear');

console.log('DEMO: generated room-climate values, not measurements. Remove with --clear (see leoiot-sensors/demo/README.md).');

const client = mqtt.connect(mqttUrl, {
  username: env.SENSORS_MQTT_USER,
  password: env.SENSORS_MQTT_PASSWORD,
  clientId: `leoiot-sensors-demo-${randomBytes(4).toString('hex')}`,
  protocolVersion: 5,
  reconnectPeriod: 5000,
});
client.on('error', (err) => console.error(`DEMO: broker error: ${err.message}`));

let timer = null;
function shutdown() {
  if (timer) clearInterval(timer);
  client.end(false, () => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

/** Publishes retained, QoS 1; returns the number of failures. */
async function publishAll(payloadOf, options) {
  const results = await Promise.allSettled(
    rooms.map((room) => client.publishAsync(TOPIC_PREFIX + room, payloadOf(room), { qos: 1, retain: true, ...options })),
  );
  const failed = results.filter((r) => r.status === 'rejected');
  if (failed.length > 0) console.error(`DEMO: ${failed.length} publish(es) failed: ${failed[0].reason?.message}`);
  return failed.length;
}

async function backfill() {
  if (!(backfillDays > 0)) return;
  const end = Math.floor(Date.now() / STEP_MS) * STEP_MS;
  const lines = [];
  for (let ts = end - backfillDays * 24 * 3600 * 1000; ts <= end; ts += STEP_MS) {
    for (const room of rooms) lines.push(lineFor(room, ts, reading(room, ts)));
  }
  await writeLines(influx, lines);
  console.log(`DEMO: backfilled ${lines.length} points (${backfillDays} days, ${rooms.length} rooms)`);
}

async function tick() {
  const ts = Date.now();
  const readings = rooms.map((room) => [room, reading(room, ts)]);
  let published = 0;
  if (client.connected) {
    const failures = await publishAll(
      (room) => JSON.stringify(liveMessage(room, ts, readings.find(([r]) => r === room)[1])),
      { properties: { messageExpiryInterval: EXPIRY_S } },
    );
    published = rooms.length - failures;
  } else {
    console.error('DEMO: broker not connected, live messages skipped this minute');
  }
  let written = 0;
  try {
    await writeLines(influx, readings.map(([room, r]) => lineFor(room, ts, r)));
    written = readings.length;
  } catch (err) {
    console.error(`DEMO: ${err.message}`);
  }
  console.log(`DEMO: published ${published}/${rooms.length} rooms, wrote ${written} points`);
}

function waitForConnect() {
  return new Promise((resolve) => (client.connected ? resolve() : client.once('connect', resolve)));
}

await waitForConnect();

if (clearMode) {
  let code = 0;
  const failures = await publishAll(() => '', {});
  if (failures > 0) code = 1;
  try {
    await deleteDemo(influx);
    console.log('DEMO: deleted every room_climate point with device=demo');
  } catch (err) {
    console.error(`DEMO: ${err.message}`);
    code = 1;
  }
  console.log(`DEMO: cleared ${rooms.length - failures} retained messages`);
  await client.endAsync();
  process.exit(code);
}

try {
  await backfill();
} catch (err) {
  console.error(`DEMO: backfill failed: ${err.message}`);
}
const run = () => tick().catch((err) => console.error(`DEMO: ${err.message}`));
await run();
timer = setInterval(run, MINUTE_MS);
