// TEMPORARY stopgap, not a permanent part of the system: see README.md.
// Publishes generated room-climate readings until the sensors team publishes.
//
//   node index.mjs           publish every room once a minute
//   node index.mjs --clear   remove the retained message of every room and exit

import mqtt from 'mqtt';
import { reading, ROOMS } from './readings.mjs';

const TOPIC = 'leoiot/room-climate/';
const INTERVAL_MS = 60_000;

const url = process.env.SIMULATOR_MQTT_URL || 'mqtt://mosquitto:1883';
for (const name of ['SIMULATOR_MQTT_USER', 'SIMULATOR_MQTT_PASSWORD']) {
  if (!process.env[name]) {
    console.error(`${name} is not set; see leoiot-3d/temporary-simulator/README.md`);
    process.exit(1);
  }
}

const client = mqtt.connect(url, {
  username: process.env.SIMULATOR_MQTT_USER,
  password: process.env.SIMULATOR_MQTT_PASSWORD,
  reconnectPeriod: 5000,
});
client.on('error', (err) => console.error(`broker ${url}: ${err.message}`));

async function publishAll(payloadOf) {
  await Promise.all(ROOMS.map((room) => client.publishAsync(TOPIC + room, payloadOf(room), { retain: true, qos: 1 })));
}

async function publishReadings() {
  const ts = Date.now();
  await publishAll((room) => JSON.stringify(reading(room, ts)));
  console.log(`published ${ROOMS.length} rooms`);
}

client.once('connect', async () => {
  try {
    if (process.argv.includes('--clear')) {
      await publishAll(() => '');
      console.log(`cleared ${ROOMS.length} rooms`);
      await client.endAsync();
      return;
    }
    console.log('TEMPORARY simulator: generated values, not real data. Delete it when the sensors team publishes.');
    await publishReadings();
    setInterval(() => publishReadings().catch((err) => console.error(err.message)), INTERVAL_MS);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
});

for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => client.end(() => process.exit(0)));
