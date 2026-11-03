#!/usr/bin/env node
// Publishes like the sensor box nili3 (ESPHome): each quantity on its own topic
// as a plain numeric string, retained, QoS 0. Values are a fixed sequence so
// that a test can compare them: CO2 700 + 10 i, temperature 22 + 0.1 i, humidity 45 + i.
//
//   node scripts/publish-nili3.mjs [--count N] [--interval ms] [--topic-prefix nili3]
//
// Connects with SENSORS_MQTT_URL, DEVICE_MQTT_USER and DEVICE_MQTT_PASSWORD
// (see collector.env of scripts/stack.mjs). Without --count it runs until stopped.
import mqtt from 'mqtt';

const args = new Map();
for (let i = 2; i < process.argv.length; i += 2) args.set(process.argv[i], process.argv[i + 1]);
const count = args.has('--count') ? Number(args.get('--count')) : Infinity;
const interval = Number(args.get('--interval') ?? 10_000);
const prefix = args.get('--topic-prefix') ?? 'nili3';

for (const name of ['SENSORS_MQTT_URL', 'DEVICE_MQTT_USER', 'DEVICE_MQTT_PASSWORD']) {
  if (!process.env[name]) {
    console.error(`${name} is not set (source collector.env first)`);
    process.exit(2);
  }
}

const client = mqtt.connect(process.env.SENSORS_MQTT_URL, {
  username: process.env.DEVICE_MQTT_USER,
  password: process.env.DEVICE_MQTT_PASSWORD,
});

const publish = (topic, text) =>
  new Promise((resolve, reject) => client.publish(topic, text, { qos: 0, retain: true }, (e) => (e ? reject(e) : resolve())));

client.once('connect', async () => {
  try {
    for (let i = 0; i < count; i++) {
      const values = {
        co2: String(700 + 10 * i),
        temperature: (22 + 0.1 * i).toFixed(1),
        humidity: String(45 + i),
      };
      for (const [quantity, text] of Object.entries(values)) {
        await publish(`${prefix}/sensor/${prefix}_${quantity}/state`, text);
        console.log(`${prefix}_${quantity} = ${text}`);
      }
      if (i + 1 < count) await new Promise((r) => setTimeout(r, interval));
    }
  } finally {
    client.end(false, () => process.exit(0));
  }
});
client.on('error', (error) => {
  console.error(error.message);
  process.exit(1);
});
