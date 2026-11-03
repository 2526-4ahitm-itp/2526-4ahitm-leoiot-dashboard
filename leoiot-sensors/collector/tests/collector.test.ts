import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { startCollector, type Collector } from '../src/collector.js';
import {
  fakeConnect,
  logCollector,
  nili3,
  NILI3_CO2,
  NILI3_HUMIDITY,
  NILI3_TEMPERATURE,
  parseLine,
  startFakeInflux,
  testConfig,
  TEST_MQTT_PASSWORD,
  TEST_MQTT_USER,
  TEST_TOKEN,
} from './helpers.js';

const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  await Promise.all(cleanup.splice(0).map((f) => f()));
});

async function setup(configOverrides: Parameters<typeof testConfig>[0] = {}) {
  const fake = await startFakeInflux();
  const mqtt = fakeConnect();
  const clock = { t: 1_790_000_000_000 };
  const { log, lines } = logCollector();
  const config = testConfig({ influxUrl: fake.url, ...configOverrides });
  const collector: Collector = startCollector({ config, devices: nili3(), log, now: () => clock.t, connect: mqtt.connect });
  cleanup.push(() => collector.stop(), () => fake.close());
  mqtt.client.open();
  return { fake, mqtt, clock, lines, collector, config };
}

const stored = (fake: { accepted: string[] }) => fake.accepted.map(parseLine);

describe('Mapped device delivers', () => {
  it('handles a CO2 value as a reading of device nili3 in room 105 with source sensor', async () => {
    const { fake, mqtt, collector } = await setup();
    mqtt.client.deliver(NILI3_CO2, '868');
    await collector.flush();
    expect(stored(fake)).toEqual([
      { tags: { device: 'nili3', room: '105', source: 'sensor' }, field: 'co2', value: 868, ns: 1_790_000_000_000_000_000n },
    ]);
  });
});

describe('Topic outside the mapping', () => {
  it('subscribes to exactly the three mapped topics and to no pattern', async () => {
    const { mqtt } = await setup();
    expect(mqtt.client.subscriptions).toEqual([[NILI3_CO2, NILI3_TEMPERATURE, NILI3_HUMIDITY]]);
    expect(mqtt.client.subscriptions.flat().some((t) => /[+#]/.test(t))).toBe(false);
  });

  it('does not handle a message on the legacy simulator topic, even if one arrived', async () => {
    const { fake, mqtt, collector } = await setup();
    mqtt.client.deliver('nili3/sensor/105_co2/state', '1234');
    mqtt.client.deliver('nili3/sensor/nili3_pressure/state', '1000');
    await collector.flush();
    expect(fake.requests).toHaveLength(0);
    expect(mqtt.client.published).toHaveLength(0);
  });
});

describe('Reading stored', () => {
  it('stores one point with only the temperature, stamped with the time of receipt', async () => {
    const { fake, mqtt, collector, clock } = await setup();
    clock.t = 1_790_000_123_456;
    mqtt.client.deliver(NILI3_TEMPERATURE, '22.4');
    await collector.flush();
    expect(fake.accepted).toEqual(['room_climate,device=nili3,room=105,source=sensor temperature=22.4 1790000123456000000']);
    expect(fake.accepted[0]).not.toContain('humidity');
    expect(fake.accepted[0]).not.toContain('co2');
  });

  it('Two quantities at nearly the same time: two points, neither carries the other as zero', async () => {
    const { fake, mqtt, collector } = await setup();
    mqtt.client.deliver(NILI3_TEMPERATURE, '22.4');
    mqtt.client.deliver(NILI3_HUMIDITY, '47');
    await collector.flush();
    const points = stored(fake);
    expect(points).toHaveLength(2);
    expect(points.map((p) => [p.field, p.value])).toEqual([
      ['temperature', 22.4],
      ['humidity', 47],
    ]);
    // Two distinct timestamps, so the database keeps two points.
    expect(points[0]!.ns).not.toBe(points[1]!.ns);
    expect(fake.accepted.join('\n')).not.toMatch(/=0(\s|$)/);
  });

  it('writes within the two-second batch interval of the real timer', async () => {
    const { fake, mqtt } = await setup({ flushIntervalMs: 30 });
    mqtt.client.deliver(NILI3_CO2, '700');
    await new Promise((r) => setTimeout(r, 200));
    expect(fake.accepted).toHaveLength(1);
  });
});

describe('Live message', () => {
  it('after a reading: published retained with QoS 1 with all known values and the time of the newest', async () => {
    const { mqtt, clock } = await setup();
    clock.t = 1000;
    mqtt.client.deliver(NILI3_CO2, '868');
    clock.t = 2000;
    mqtt.client.deliver(NILI3_HUMIDITY, '47');
    clock.t = 3000;
    mqtt.client.deliver(NILI3_TEMPERATURE, '22.4');
    const last = mqtt.client.published.at(-1)!;
    expect(last.topic).toBe('leoiot/room-climate/105');
    expect(last.options).toEqual({ qos: 1, retain: true });
    expect(JSON.parse(last.payload)).toEqual({
      room: '105',
      device: 'nili3',
      source: 'sensor',
      ts: 3000,
      co2: 868,
      temperature: 22.4,
      humidity: 47,
    });
    expect(mqtt.client.published).toHaveLength(3);
  });

  it('First reading after a restart: CO2 only, the others appear once delivered', async () => {
    const { mqtt, clock } = await setup();
    clock.t = 5000;
    mqtt.client.deliver(NILI3_CO2, '868');
    expect(mqtt.client.live()).toEqual([{ room: '105', device: 'nili3', source: 'sensor', ts: 5000, co2: 868 }]);
    clock.t = 6000;
    mqtt.client.deliver(NILI3_TEMPERATURE, '22.4');
    expect(mqtt.client.live().at(-1)).toEqual({ room: '105', device: 'nili3', source: 'sensor', ts: 6000, co2: 868, temperature: 22.4 });
  });

  it('is published on the topic of every mapped room', async () => {
    const { mqtt } = await setup();
    mqtt.client.deliver(NILI3_CO2, '868');
    expect(mqtt.client.published.map((p) => p.topic)).toEqual(['leoiot/room-climate/105']);
  });

  it('Box switched off: no delivery, no point and no new live message', async () => {
    const { fake, mqtt, collector, clock } = await setup();
    mqtt.client.deliver(NILI3_CO2, '868');
    await collector.flush();
    const before = { points: fake.accepted.length, live: mqtt.client.published.length };
    clock.t += 3_600_000;
    await collector.flush();
    expect(fake.accepted).toHaveLength(before.points);
    expect(mqtt.client.published).toHaveLength(before.live);
    expect(collector.status().healthy).toBe(true);
  });
});

describe('Invalid values are dropped', () => {
  for (const text of ['nan', 'unavailable']) {
    it(`Device reports an unavailable sensor (${text}): not stored, not published, logged, next valid value handled`, async () => {
      const { fake, mqtt, collector, lines } = await setup();
      mqtt.client.deliver(NILI3_CO2, text);
      await collector.flush();
      expect(fake.requests).toHaveLength(0);
      expect(mqtt.client.published).toHaveLength(0);
      const dropped = lines.filter((l) => l.startsWith('Dropped value'));
      expect(dropped).toHaveLength(1);
      expect(dropped[0]).toContain('nili3');
      expect(dropped[0]).toContain('co2');
      expect(dropped[0]).toContain(`"${text}"`);

      mqtt.client.deliver(NILI3_CO2, '655');
      await collector.flush();
      expect(stored(fake).map((p) => [p.field, p.value])).toEqual([['co2', 655]]);
      expect(mqtt.client.live()).toHaveLength(1);
    });
  }

  it('Value out of range: humidity 140 is neither stored nor published, and the log says so', async () => {
    const { fake, mqtt, collector, lines } = await setup();
    mqtt.client.deliver(NILI3_HUMIDITY, '140');
    await collector.flush();
    expect(fake.requests).toHaveLength(0);
    expect(mqtt.client.published).toHaveLength(0);
    expect(lines.join('\n')).toMatch(/Dropped value of device nili3, humidity: received "140" \(out of range/);
  });

  it('a dropped value does not change the live message of the other quantities', async () => {
    const { mqtt, clock } = await setup();
    clock.t = 1;
    mqtt.client.deliver(NILI3_CO2, '868');
    clock.t = 2;
    mqtt.client.deliver(NILI3_CO2, 'nan');
    expect(mqtt.client.published).toHaveLength(1);
  });
});

describe('Retained device messages are not deliveries', () => {
  it('ignores the old last value the broker replays on subscribe', async () => {
    const { fake, mqtt, collector, lines } = await setup();
    mqtt.client.deliver(NILI3_CO2, '868', true);
    await collector.flush();
    expect(fake.requests).toHaveLength(0);
    expect(mqtt.client.published).toHaveLength(0);
    expect(lines.join('\n')).toContain('Ignoring retained device message');
    mqtt.client.deliver(NILI3_CO2, '870', false);
    await collector.flush();
    expect(stored(fake)).toHaveLength(1);
  });
});

describe('Broker restarted', () => {
  it('subscribes again on every connection and handles the first value afterwards', async () => {
    const { fake, mqtt, collector, lines } = await setup();
    mqtt.client.deliver(NILI3_CO2, '868');
    mqtt.client.drop();
    mqtt.client.open();
    expect(mqtt.client.subscriptions).toHaveLength(2);
    expect(mqtt.client.subscriptions[1]).toEqual(mqtt.client.subscriptions[0]);
    mqtt.client.deliver(NILI3_TEMPERATURE, '21.9');
    await collector.flush();
    expect(stored(fake).map((p) => p.field)).toEqual(['co2', 'temperature']);
    expect(mqtt.client.live()).toHaveLength(2);
    expect(mqtt.connects()).toBe(1);
    expect(lines.filter((l) => l.startsWith('Connected to the broker'))).toHaveLength(2);
  });
});

describe('Database unreachable for ten minutes', () => {
  it('stores every reading afterwards with its original time, and publishes live messages throughout', async () => {
    const { fake, mqtt, collector, clock } = await setup();
    fake.setStatus(500);
    const sent: { quantity: string; text: string; ms: number }[] = [];
    const topics: Record<string, string> = { co2: NILI3_CO2, temperature: NILI3_TEMPERATURE, humidity: NILI3_HUMIDITY };
    const names = ['co2', 'temperature', 'humidity'];
    for (let s = 0; s < 600; s += 10) {
      clock.t = 1_790_000_000_000 + s * 1000;
      const quantity = names[(s / 10) % 3]!;
      const text = quantity === 'co2' ? String(700 + s / 10) : quantity === 'temperature' ? '22.4' : '47';
      sent.push({ quantity, text, ms: clock.t });
      mqtt.client.deliver(topics[quantity]!, text);
      await collector.flush();
    }
    expect(mqtt.client.published).toHaveLength(sent.length);
    expect(fake.accepted).toHaveLength(0);
    fake.setStatus(204);
    clock.t += 2000;
    await collector.flush();
    expect(stored(fake).map((p) => [p.field, p.value, p.ns / 1_000_000n])).toEqual(
      sent.map((x) => [x.quantity, Number(x.text), BigInt(x.ms)]),
    );
    expect(collector.queued()).toBe(0);
  });
});

describe('Health is reported', () => {
  it('Database down: unhealthy after six minutes of failing writes, healthy after the first success', async () => {
    const { fake, mqtt, collector, clock } = await setup();
    fake.setStatus(500);
    mqtt.client.deliver(NILI3_CO2, '868');
    await collector.flush();
    clock.t += 6 * 60_000;
    await collector.flush();
    expect(collector.status()).toMatchObject({ healthy: false });
    expect(collector.status().reason).toContain('database writes failing');
    fake.setStatus(204);
    await collector.flush();
    expect(collector.status().healthy).toBe(true);
  });

  it('is unhealthy when the broker has been gone for more than two minutes', async () => {
    const { mqtt, collector, clock } = await setup();
    mqtt.client.drop();
    clock.t += 121_000;
    expect(collector.status().healthy).toBe(false);
    mqtt.client.open();
    expect(collector.status().healthy).toBe(true);
  });

  it('keeps writing the status file', async () => {
    const { config, clock } = await setup({ healthIntervalMs: 20 });
    clock.t += 1234;
    await new Promise((r) => setTimeout(r, 150));
    const file = JSON.parse(readFileSync(config.healthFile, 'utf8'));
    expect(file.healthy).toBe(true);
    expect(file.updatedAt).toBe(clock.t);
  });
});

describe('Credentials are never logged', () => {
  it('no log line contains the token, the broker account or its password', async () => {
    const { fake, mqtt, collector, lines } = await setup();
    fake.setStatus(401);
    mqtt.client.deliver(NILI3_CO2, '868');
    mqtt.client.deliver(NILI3_CO2, 'nan');
    mqtt.client.emit('error', new Error('Connection refused: Not authorized'));
    await collector.flush();
    const text = lines.join('\n');
    expect(text.length).toBeGreaterThan(100);
    for (const secret of [TEST_TOKEN, TEST_MQTT_PASSWORD, TEST_MQTT_USER]) expect(text).not.toContain(secret);
  });
});
