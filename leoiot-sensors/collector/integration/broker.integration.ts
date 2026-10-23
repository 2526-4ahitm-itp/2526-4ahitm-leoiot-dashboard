// Task 2.5: the broker side against a throwaway Mosquitto 2.1 with accounts and
// ACL like production (spec sensors/collector: Topic outside the mapping,
// Broker restarted; spec platform/broker: Retained messages survive a restart).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  docker,
  listen,
  publishAsDevice,
  queryRoomClimate,
  runCollector,
  sleep,
  startStack,
  stopStack,
  waitFor,
  waitForBroker,
  type Stack,
} from './support.js';

let stack: Stack;
let collector: ReturnType<typeof runCollector> | undefined;

const LIVE = 'leoiot/room-climate/105';
const collectorAuth = () => ({ username: stack.env.SENSORS_MQTT_USER!, password: stack.env.SENSORS_MQTT_PASSWORD! });
const liveOf = async () => {
  const reader = listen(stack.env.SENSORS_MQTT_URL!, 'leoiot/room-climate/#', collectorAuth());
  try {
    await sleep(800);
    return reader.messages.map((m) => ({ ...m, json: JSON.parse(m.payload) }));
  } finally {
    await reader.close();
  }
};

beforeAll(async () => {
  stack = startStack('broker');
  // A retained old value of the box is waiting on its topic before the collector starts.
  await publishAsDevice(stack, 'nili3/sensor/nili3_co2/state', '1234', true);
  collector = runCollector({
    ...stack.env,
    SENSORS_FLUSH_INTERVAL_MS: '200',
    SENSORS_MQTT_RECONNECT_MS: '300',
    SENSORS_HEALTH_INTERVAL_MS: '500',
  });
  await waitFor('the subscription', () => collector!.output().includes('Subscribed to 3 topic(s)'));
});

afterAll(async () => {
  await collector?.stop();
  stopStack(stack);
});

describe('Broker side against a throwaway Mosquitto', () => {
  it('ignores the retained old value the broker replays when the collector subscribes', async () => {
    await sleep(1000);
    expect(await queryRoomClimate(stack)).toEqual([]);
    expect(collector!.output()).toContain('Ignoring retained device message');
  });

  it('Topic outside the mapping: a message on the legacy simulator topic is not received', async () => {
    await publishAsDevice(stack, 'nili3/sensor/105_co2/state', '999', false);
    await publishAsDevice(stack, 'nili3/sensor/nili3_co2/state', '600', false);
    const rows = await waitFor('the mapped value to be stored', async () => {
      const r = await queryRoomClimate(stack);
      return r.length >= 1 ? r : null;
    });
    await sleep(800);
    const all = await queryRoomClimate(stack);
    expect(all.map((r) => [r.field, r.value])).toEqual([['co2', 600]]);
    expect(rows).toHaveLength(1);
    const live = await liveOf();
    expect(live).toHaveLength(1);
    expect(live[0]!.json).toMatchObject({ co2: 600 });
    expect(JSON.stringify(live)).not.toContain('999');
  });

  it('the broker saw subscriptions to the three mapped topics and to no pattern', () => {
    const log = docker('logs', `${stack.name}-mosquitto`);
    const subscribed = log
      .split('\n')
      .map((l) => /(sensors-collector-[0-9a-f]+) \d (\S+)$/.exec(l))
      .filter((m): m is RegExpExecArray => m !== null && !m[2]!.startsWith('leoiot/'))
      .map((m) => m[2]);
    expect([...new Set(subscribed)].sort()).toEqual([
      'nili3/sensor/nili3_co2/state',
      'nili3/sensor/nili3_humidity/state',
      'nili3/sensor/nili3_temperature/state',
    ]);
  });

  it('a new subscriber to leoiot/room-climate/# gets the retained message at once, with the retain flag', async () => {
    const reader = listen(stack.env.SENSORS_MQTT_URL!, 'leoiot/room-climate/#', collectorAuth());
    try {
      const message = await waitFor('the retained message', () => reader.messages[0]);
      expect(message.topic).toBe(LIVE);
      expect(message.retain).toBe(true);
      expect(JSON.parse(message.payload)).toMatchObject({ room: '105', device: 'nili3', source: 'sensor', co2: 600 });
    } finally {
      await reader.close();
    }
  });

  it('a browser connection without credentials gets the retained message over WebSocket and cannot publish', async () => {
    const reader = listen(`ws://127.0.0.1:${stack.wsPort}`, 'leoiot/room-climate/#');
    try {
      const message = await waitFor('the retained message over WebSocket', () => reader.messages[0]);
      expect(JSON.parse(message.payload).room).toBe('105');
      reader.client.publish(LIVE, '{"room":"105","co2":1}', { retain: true });
      await sleep(800);
      const live = await liveOf();
      expect(live[0]!.json.co2).toBe(600);
    } finally {
      await reader.close();
    }
  });

  it('Broker restarted: the collector reconnects, subscribes again and stores and publishes the next value', async () => {
    docker('restart', `${stack.name}-mosquitto`);
    await waitForBroker(stack);
    await waitFor('the second connection', () => (collector!.output().match(/Connected to the broker/g) ?? []).length >= 2, 30_000);
    await waitFor('the second subscription', () => (collector!.output().match(/Subscribed to 3 topic/g) ?? []).length >= 2, 30_000);
    expect(collector!.process.exitCode).toBeNull();

    await publishAsDevice(stack, 'nili3/sensor/nili3_temperature/state', '21.5', false);
    await waitFor('the temperature point', async () => (await queryRoomClimate(stack)).some((r) => r.field === 'temperature' && r.value === 21.5));
    const live = await liveOf();
    expect(live).toHaveLength(1);
    expect(live[0]!.json).toMatchObject({ co2: 600, temperature: 21.5 });
  });

  it('Retained messages survive the restart: the room message is there for a new subscriber', async () => {
    const live = await liveOf();
    expect(live[0]!.retain).toBe(true);
  });

  it('after the restart the old retained device value was replayed on subscribe and ignored again', async () => {
    // The retained 600 on nili3_co2 came back with the second subscription and must not have become a new point.
    const rows = await queryRoomClimate(stack, 'filter(fn: (r) => r._field == "co2")');
    expect(rows.map((r) => r.value)).toEqual([600]);
  });
});
