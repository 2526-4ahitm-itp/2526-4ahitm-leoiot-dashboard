// Helpers for the integration tests: a throwaway Mosquitto and InfluxDB in Docker
// (scripts/stack.mjs), queries against them, and small waiting utilities.
// Needs Docker. Not run by "npm test".
import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import mqtt, { type MqttClient } from 'mqtt';

export const collectorDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export interface Stack {
  name: string;
  dir: string;
  envFile: string;
  mqttPort: number;
  wsPort: number;
  influxPort: number;
  influxToken: string;
  /** Variables of collector.env. */
  env: Record<string, string>;
}

export function parseEnvFile(file: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(line);
    if (match) env[match[1]!] = match[2]!;
  }
  return env;
}

export function startStack(label: string): Stack {
  const name = `leoiot-sensors-it-${label}-${process.pid}`;
  const dir = mkdtempSync(join(tmpdir(), 'leoiot-sensors-it-'));
  const out = execFileSync(process.execPath, ['scripts/stack.mjs', 'up', '--name', name, '--dir', dir], {
    cwd: collectorDir,
    encoding: 'utf8',
  });
  const stack = JSON.parse(out) as Omit<Stack, 'env'>;
  return { ...stack, env: parseEnvFile(stack.envFile) };
}

export function stopStack(stack: Stack | undefined): void {
  if (!stack) return;
  execFileSync(process.execPath, ['scripts/stack.mjs', 'down', '--name', stack.name, '--dir', stack.dir], { cwd: collectorDir });
  rmSync(stack.dir, { recursive: true, force: true });
}

export function docker(...args: string[]): string {
  return execFileSync('docker', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function waitFor<T>(what: string, check: () => T | Promise<T>, timeoutMs = 30_000): Promise<NonNullable<T>> {
  const end = Date.now() + timeoutMs;
  let last: unknown;
  while (Date.now() < end) {
    try {
      const value = await check();
      if (value) return value as NonNullable<T>;
    } catch (error) {
      last = error;
    }
    await sleep(150);
  }
  throw new Error(`timed out waiting for ${what}${last ? `: ${(last as Error).message}` : ''}`);
}

export async function waitForInflux(stack: Stack): Promise<void> {
  await waitFor('InfluxDB', async () => (await fetch(`http://127.0.0.1:${stack.influxPort}/health`)).ok, 60_000);
}

export async function waitForBroker(stack: Stack): Promise<void> {
  const client = mqtt.connect(stack.env.SENSORS_MQTT_URL!, {
    username: stack.env.DEVICE_MQTT_USER,
    password: stack.env.DEVICE_MQTT_PASSWORD,
    reconnectPeriod: 200,
  });
  client.on('error', () => {});
  try {
    await waitFor('the broker', () => client.connected, 30_000);
  } finally {
    await client.endAsync(true);
  }
}

export interface Row {
  time: string;
  field: string;
  value: number;
  datatype: string;
  tags: Record<string, string>;
}

/** All room_climate points of the last hour, oldest first, one row per field value. */
export async function queryRoomClimate(stack: Stack, extraFilter = ''): Promise<Row[]> {
  const query = `from(bucket: "server_data") |> range(start: -1h) |> filter(fn: (r) => r._measurement == "room_climate")${extraFilter ? ` |> ${extraFilter}` : ''} |> group() |> sort(columns: ["_time"])`;
  const response = await fetch(`http://127.0.0.1:${stack.influxPort}/api/v2/query?org=leoiot`, {
    method: 'POST',
    headers: { Authorization: `Token ${stack.influxToken}`, 'Content-Type': 'application/json', Accept: 'application/csv' },
    body: JSON.stringify({ query, type: 'flux', dialect: { annotations: ['datatype'] } }),
  });
  if (!response.ok) throw new Error(`query failed: HTTP ${response.status} ${await response.text()}`);
  const lines = (await response.text()).split('\n').map((l) => l.replace(/\r$/, ''));
  const rows: Row[] = [];
  let datatypes: string[] = [];
  let header: string[] = [];
  for (const line of lines) {
    if (line === '') continue;
    const cells = line.split(',');
    if (line.startsWith('#datatype')) {
      datatypes = cells;
    } else if (cells[1] === 'result') {
      header = cells;
    } else if (header.length > 0) {
      const get = (name: string) => cells[header.indexOf(name)]!;
      rows.push({
        time: get('_time'),
        field: get('_field'),
        value: Number(get('_value')),
        datatype: datatypes[header.indexOf('_value')]!,
        tags: { device: get('device'), room: get('room'), source: get('source') },
      });
    }
  }
  return rows;
}

/** Subscribes and returns the received messages as they come. */
export function listen(url: string, topic: string, auth?: { username: string; password: string }) {
  const messages: { topic: string; payload: string; retain: boolean }[] = [];
  const client: MqttClient = mqtt.connect(url, { ...auth, reconnectPeriod: 200 });
  client.on('error', () => {});
  client.on('connect', () => client.subscribe(topic));
  client.on('message', (t, p, packet) => messages.push({ topic: t, payload: p.toString('utf8'), retain: packet.retain }));
  return { messages, client, close: () => client.endAsync(true) };
}

/** Publishes one message with the device account and waits until it is sent. */
export async function publishAsDevice(stack: Stack, topic: string, text: string, retain = true): Promise<void> {
  const client = mqtt.connect(stack.env.SENSORS_MQTT_URL!, {
    username: stack.env.DEVICE_MQTT_USER,
    password: stack.env.DEVICE_MQTT_PASSWORD,
    reconnectPeriod: 0,
  });
  try {
    await new Promise<void>((resolveOk, reject) => {
      client.once('error', reject);
      client.once('connect', () => client.publish(topic, text, { qos: 1, retain }, (e) => (e ? reject(e) : resolveOk())));
    });
  } finally {
    await client.endAsync(false);
  }
}

/** Runs the compiled collector (node dist/main.js) like the container does. */
export function runCollector(env: Record<string, string>): { process: ChildProcess; output: () => string; stop: () => Promise<void> } {
  let output = '';
  const child = spawn(process.execPath, ['dist/main.js'], {
    cwd: collectorDir,
    env: { PATH: process.env.PATH ?? '', ...env },
  });
  child.stdout.on('data', (d) => (output += d));
  child.stderr.on('data', (d) => (output += d));
  return {
    process: child,
    output: () => output,
    stop: () =>
      new Promise<void>((resolveStop) => {
        if (child.exitCode !== null) return resolveStop();
        child.once('exit', () => resolveStop());
        child.kill('SIGTERM');
      }),
  };
}
