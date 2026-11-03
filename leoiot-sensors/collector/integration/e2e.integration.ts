// Task 2.7: end to end on a local stack. A script publishes like the sensor box
// nili3, the compiled collector runs as in the container, and the result is
// checked in InfluxDB and on the retained live topic against platform/data-contract.
import { execFileSync } from 'node:child_process';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  collectorDir,
  listen,
  queryRoomClimate,
  runCollector,
  startStack,
  stopStack,
  waitFor,
  type Row,
  type Stack,
} from './support.js';

let stack: Stack;
let collector: ReturnType<typeof runCollector>;
let rows: Row[];
let window: { from: number; to: number };
let exitCode: number | null;

beforeAll(async () => {
  stack = startStack('e2e');
  collector = runCollector({ ...stack.env, SENSORS_FLUSH_INTERVAL_MS: '500', SENSORS_HEALTH_INTERVAL_MS: '500' });
  await waitFor('the subscription', () => collector.output().includes('Subscribed to 3 topic(s)'));

  const from = Date.now();
  execFileSync(process.execPath, ['scripts/publish-nili3.mjs', '--count', '3', '--interval', '400'], {
    cwd: collectorDir,
    env: { PATH: process.env.PATH ?? '', ...stack.env },
  });
  const to = Date.now();
  window = { from, to };
  rows = await waitFor('nine points', async () => {
    const r = await queryRoomClimate(stack);
    return r.length >= 9 ? r : null;
  });
  // The retained live message of the last reading
  await waitFor('the last live message', async () => {
    const reader = listen(stack.env.SENSORS_MQTT_URL!, 'leoiot/room-climate/#', {
      username: stack.env.SENSORS_MQTT_USER!,
      password: stack.env.SENSORS_MQTT_PASSWORD!,
    });
    try {
      await new Promise((r) => setTimeout(r, 500));
      return reader.messages.at(-1)?.payload.includes('"humidity":47') ?? false;
    } finally {
      await reader.close();
    }
  });
  const before = collector.process.exitCode;
  await collector.stop();
  exitCode = before === null ? collector.process.exitCode : before;
});

afterAll(async () => {
  await collector?.stop();
  stopStack(stack);
});

describe('End to end on a local stack', () => {
  it('stores nine points: three values of each quantity, tagged room 105, device nili3, source sensor', () => {
    expect(rows).toHaveLength(9);
    for (const row of rows) expect(row.tags).toEqual({ device: 'nili3', room: '105', source: 'sensor' });
    const byField = (field: string) => rows.filter((r) => r.field === field).map((r) => r.value);
    expect(byField('co2')).toEqual([700, 710, 720]);
    expect(byField('temperature')).toEqual([22, 22.1, 22.2]);
    expect(byField('humidity')).toEqual([45, 46, 47]);
  });

  it('every field is a float, even a whole number such as 700', () => {
    for (const row of rows) expect(row.datatype, `${row.field} ${row.value}`).toBe('double');
  });

  it('each value is its own point: no two values share a timestamp, so none carries another quantity', () => {
    expect(new Set(rows.map((r) => r.time)).size).toBe(rows.length);
  });

  it('points are stamped with the time of receipt', () => {
    for (const row of rows) {
      const ms = Date.parse(row.time);
      expect(ms).toBeGreaterThanOrEqual(window.from - 50);
      expect(ms).toBeLessThanOrEqual(window.to + 50);
    }
  });

  it('the retained live message has the contract shape', async () => {
    const reader = listen(`ws://127.0.0.1:${stack.wsPort}`, 'leoiot/room-climate/#');
    try {
      const message = await waitFor('the live message over WebSocket', () => reader.messages[0]);
      expect(message.topic).toBe('leoiot/room-climate/105');
      expect(message.retain).toBe(true);
      const json = JSON.parse(message.payload);
      expect(Object.keys(json).sort()).toEqual(['co2', 'device', 'humidity', 'room', 'source', 'temperature', 'ts']);
      expect(json).toMatchObject({ room: '105', device: 'nili3', source: 'sensor', co2: 720, temperature: 22.2, humidity: 47 });
      expect(Number.isInteger(json.ts)).toBe(true);
      // ts is the receipt time of the last value (humidity), the same instant as its point
      const humidity = rows.filter((r) => r.field === 'humidity').at(-1)!;
      expect(Math.abs(json.ts - Date.parse(humidity.time))).toBeLessThanOrEqual(1);
    } finally {
      await reader.close();
    }
  });

  it('the log names neither the token nor the broker password', () => {
    const output = collector.output();
    expect(output).toContain('Start: 1 device(s)');
    expect(output).not.toContain(stack.env.SENSORS_INFLUX_TOKEN!);
    expect(output).not.toContain(stack.env.SENSORS_MQTT_PASSWORD!);
  });

  it('stops cleanly on SIGTERM', () => {
    expect(exitCode).toBe(0);
  });
});
