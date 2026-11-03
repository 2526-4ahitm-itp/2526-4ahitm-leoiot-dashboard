import { EventEmitter } from 'node:events';
import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { MqttConnect, MqttLike } from '../src/broker.js';
import { loadConfig, type Config } from '../src/config.js';
import { parseDevices, type Device } from '../src/devices.js';

export const NILI3_CO2 = 'nili3/sensor/nili3_co2/state';
export const NILI3_TEMPERATURE = 'nili3/sensor/nili3_temperature/state';
export const NILI3_HUMIDITY = 'nili3/sensor/nili3_humidity/state';

export const TEST_TOKEN = 'test-token-not-secret';
export const TEST_MQTT_USER = 'test-mqtt-user';
export const TEST_MQTT_PASSWORD = 'test-mqtt-password';

export const nili3Mapping = {
  devices: [
    {
      device: 'nili3',
      room: '105',
      source: 'sensor',
      topics: { co2: NILI3_CO2, temperature: NILI3_TEMPERATURE, humidity: NILI3_HUMIDITY },
    },
  ],
};

export function nili3(): Device[] {
  return parseDevices(nili3Mapping);
}

export function testConfig(overrides: Partial<Config> = {}, env: Record<string, string> = {}): Config {
  return {
    ...loadConfig({
      SENSORS_INFLUX_TOKEN: TEST_TOKEN,
      SENSORS_MQTT_USER: TEST_MQTT_USER,
      SENSORS_MQTT_PASSWORD: TEST_MQTT_PASSWORD,
      // Timers stay out of the way: tests call flush() themselves.
      SENSORS_FLUSH_INTERVAL_MS: '3600000',
      SENSORS_HEALTH_INTERVAL_MS: '3600000',
      SENSORS_HEALTH_FILE: join(mkdtempSync(join(tmpdir(), 'sensors-health-')), 'health.json'),
      ...env,
    }),
    ...overrides,
  };
}

/** A fake MQTT client that records subscribes and publishes and lets a test play the broker. */
export class FakeMqtt extends EventEmitter implements MqttLike {
  connected = false;
  subscriptions: string[][] = [];
  published: { topic: string; payload: string; options: { qos: number; retain: boolean } }[] = [];
  ended = false;

  subscribe(topics: string[], _options: { qos: 0 | 1 | 2 }, callback?: (e: Error | null, g?: { topic: string; qos: number }[]) => void): this {
    this.subscriptions.push([...topics]);
    callback?.(null, topics.map((topic) => ({ topic, qos: 1 })));
    return this;
  }

  publish(topic: string, payload: string, options: { qos: 0 | 1 | 2; retain: boolean }, callback?: (e?: Error | null) => void): this {
    this.published.push({ topic, payload, options });
    callback?.(null);
    return this;
  }

  end(_force?: boolean, callback?: () => void): this {
    this.ended = true;
    this.connected = false;
    callback?.();
    return this;
  }

  /** The broker accepts the connection. */
  open(): void {
    this.connected = true;
    this.emit('connect');
  }

  /** The connection is lost. */
  drop(): void {
    this.connected = false;
    this.emit('close');
  }

  /** The broker delivers a message to the collector. */
  deliver(topic: string, text: string, retain = false): void {
    this.emit('message', topic, Buffer.from(text), { retain });
  }

  live(): Record<string, unknown>[] {
    return this.published.map((p) => JSON.parse(p.payload));
  }
}

export function fakeConnect(): { connect: MqttConnect; client: FakeMqtt; connects: () => number } {
  const client = new FakeMqtt();
  let count = 0;
  return {
    client,
    connects: () => count,
    connect: () => {
      count++;
      return client;
    },
  };
}

export interface Recorded {
  method: string;
  url: string;
  headers: IncomingMessage['headers'];
  body: string;
}

/** A fake InfluxDB write endpoint on a free port. `status` decides the answer. */
export async function startFakeInflux(): Promise<{
  url: string;
  requests: Recorded[];
  status: number;
  /** All stored lines in the order they were accepted. */
  accepted: string[];
  close: () => Promise<void>;
  setStatus: (status: number) => void;
}> {
  const requests: Recorded[] = [];
  const accepted: string[] = [];
  const state = { status: 204 };
  const server: Server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => {
      const body = Buffer.concat(chunks).toString('utf8');
      requests.push({ method: req.method ?? '', url: req.url ?? '', headers: req.headers, body });
      if (state.status < 300) accepted.push(...body.split('\n').filter((l) => l !== ''));
      res.statusCode = state.status;
      res.end(state.status < 300 ? '' : '{"code":"error","message":"fake failure"}');
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as AddressInfo).port;
  return {
    url: `http://127.0.0.1:${port}`,
    requests,
    accepted,
    get status() {
      return state.status;
    },
    setStatus: (status) => {
      state.status = status;
    },
    close: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  };
}

export function logCollector(): { log: (m: string) => void; lines: string[] } {
  const lines: string[] = [];
  return { log: (m) => lines.push(m), lines };
}

/** Parses "room_climate,device=...,room=...,source=... field=value ns". */
export function parseLine(line: string): { tags: Record<string, string>; field: string; value: number; ns: bigint } {
  const [head, fields, ts] = line.split(' ');
  const [measurement, ...tagParts] = head!.split(',');
  if (measurement !== 'room_climate') throw new Error(`unexpected measurement in ${line}`);
  const tags = Object.fromEntries(tagParts.map((t) => t.split('=') as [string, string]));
  const [field, value] = fields!.split('=');
  return { tags, field: field!, value: Number(value), ns: BigInt(ts!) };
}
