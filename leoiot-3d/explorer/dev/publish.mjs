// Development publisher: sends simulated room-climate readings to a local
// broker, in the message shape of platform/data-contract ("Room-climate live
// data is published per room"). Local testing only.
//
//   npm run dev:publish              publish the fixed set, then live updates every 5 s
//   npm run dev:publish -- --once    publish the fixed set and exit
//   npm run dev:publish -- --clear   remove every retained message this script publishes
//
// Broker: DEV_MQTT_URL, default mqtt://localhost:1883 (compose.dev.yaml).
// The vm23 broker refuses anonymous publishing, so this cannot reach it.

import mqtt from 'mqtt';

const url = process.env.DEV_MQTT_URL || 'mqtt://localhost:1883';
const TOPIC = 'leoiot/room-climate/';
const DEVICE = 'dev-publisher';
const MINUTE = 60_000;

// Fixed readings: CO₂ on both sides of the FR-07 limits (599/600, 1200/1201),
// temperatures across the 20–25 °C scale, rooms with one field only, and
// stale rooms (age in minutes). Rooms such as 106 and U08 get no message.
const fixed = [
  // basement
  { room: 'U04', co2: 500, temperature: 19.0 },
  { room: 'U74.1', co2: 1000, temperature: 21.0 },
  { room: 'UBiolab', co2: 1500, temperature: 23.5 },
  // ground floor
  { room: 'E05', co2: 450, temperature: 20.5 },
  { room: 'E10', co2: 650, temperature: 21.5 },
  { room: 'E22', co2: 1300, temperature: 24.0 },
  { room: 'E581', co2: 900, temperature: 22.0, ageMin: 12 },
  // floor 1
  { room: '103', co2: 399, temperature: 18.0 },
  { room: '104', co2: 599, temperature: 20.0 },
  { room: '105', co2: 850, temperature: 22.4 },
  { room: '107', temperature: 21.0 },
  { room: '108', co2: 600, temperature: 22.5 },
  { room: '109', co2: 1200, temperature: 25.0 },
  { room: '119', co2: 1201, temperature: 27.5 },
  { room: '121', co2: 2600, temperature: 23.0 },
  { room: '153', co2: 700 },
  { room: '154', co2: 900, temperature: 21.3, ageMin: 12 },
  { room: '1Aula', co2: 550, temperature: 20.8 },
  // floor 2
  { room: '203', co2: 800, temperature: 22.0 },
  { room: '230', co2: 420, temperature: 20.2 },
  { room: '251', co2: 1100, temperature: 23.0 },
  // gym
  { room: 'T1', co2: 600, temperature: 19.5 },
  { room: 'T10', co2: 900, temperature: 20.0 },
];

// Rooms that get a new reading every 5 seconds (a small random walk)
const live = ['105', 'E10', 'U04', '203', 'T1'];

const args = new Set(process.argv.slice(2));
const client = mqtt.connect(url, { clientId: `${DEVICE}-${process.pid}`, reconnectPeriod: 2000 });

function message(r, ts) {
  const m = { room: r.room, device: DEVICE, source: 'simulated', ts };
  if (r.co2 !== undefined) m.co2 = r.co2;
  if (r.temperature !== undefined) m.temperature = r.temperature;
  return JSON.stringify(m);
}

function publish(topic, payload) {
  return new Promise((resolve, reject) =>
    client.publish(topic, payload, { retain: true, qos: 1 }, (err) => (err ? reject(err) : resolve())),
  );
}

async function publishFixed() {
  const now = Date.now();
  for (const r of fixed) await publish(TOPIC + r.room, message(r, now - (r.ageMin ?? 0) * MINUTE));
  console.log(`published ${fixed.length} rooms to ${url}`);
}

async function clear() {
  for (const r of fixed) await publish(TOPIC + r.room, '');
  console.log(`cleared ${fixed.length} retained messages on ${url}`);
}

function step(value, delta, min, max) {
  const next = value + (Math.random() * 2 - 1) * delta;
  return Math.min(max, Math.max(min, next));
}

function startLive() {
  const state = new Map(live.map((room) => [room, { ...fixed.find((r) => r.room === room) }]));
  setInterval(async () => {
    for (const r of state.values()) {
      r.co2 = Math.round(step(r.co2, 80, 380, 2200));
      r.temperature = Math.round(step(r.temperature, 0.4, 17, 28) * 10) / 10;
      await publish(TOPIC + r.room, message(r, Date.now()));
    }
    console.log(`updated ${live.join(', ')}`);
  }, 5000);
}

client.on('error', (err) => console.error(`broker ${url}: ${err.message}`));
client.once('connect', async () => {
  try {
    if (args.has('--clear')) {
      await clear();
      client.end();
      return;
    }
    await publishFixed();
    if (args.has('--once')) {
      client.end();
      return;
    }
    console.log('live updates every 5 s, Ctrl+C to stop');
    startLive();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
});
process.on('SIGINT', () => {
  client.end();
  process.exit(0);
});
