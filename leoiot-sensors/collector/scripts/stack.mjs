#!/usr/bin/env node
// A throwaway local stack for the collector: Mosquitto 2.1 and InfluxDB 2.7 in
// Docker, on free ports of 127.0.0.1, with made-up test accounts and a test
// token. Nothing here is a real credential; the password values are generated
// fresh at every "up" and live only in the stack directory.
//
//   node scripts/stack.mjs up   [--name <name>] [--dir <dir>]
//   node scripts/stack.mjs down [--name <name>] [--dir <dir>]
//
// "up" prints the stack as JSON and writes <dir>/collector.env, which a shell
// can source ("set -a; . <dir>/collector.env; set +a"). The broker has the same
// shape as production: port 1883 with accounts (the collector's account may
// read everything and publish only leoiot/room-climate/#, as in
// leoiot-platform/broker/acl.example), plus an anonymous read-only WebSocket
// listener for browsers (leoiot-platform/broker/acl-websocket).
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createServer, connect } from 'node:net';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const MOSQUITTO_IMAGE = 'eclipse-mosquitto:2.1.2-alpine';
const INFLUX_IMAGE = 'influxdb:2.7';
export const TEST_INFLUX_TOKEN = 'test-token-not-secret';

const collectorDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function docker(...args) {
  return execFileSync('docker', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function freePort() {
  return new Promise((resolvePort, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolvePort(port));
    });
  });
}

function tcpOpen(port) {
  return new Promise((resolveOpen) => {
    const socket = connect(port, '127.0.0.1');
    socket.once('connect', () => (socket.destroy(), resolveOpen(true)));
    socket.once('error', () => resolveOpen(false));
  });
}

async function waitFor(what, check, timeoutMs = 90_000) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    if (await check().catch(() => false)) return;
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`timed out waiting for ${what}`);
}

function options(argv) {
  const out = { name: 'leoiot-sensors-dev', dir: join(collectorDir, '.dev-stack') };
  for (let i = 0; i < argv.length; i += 2) {
    if (argv[i] === '--name') out.name = argv[i + 1];
    else if (argv[i] === '--dir') out.dir = resolve(argv[i + 1]);
    else throw new Error(`unknown option ${argv[i]}`);
  }
  return out;
}

export function remove(name) {
  for (const container of [`${name}-mosquitto`, `${name}-influxdb`]) {
    try {
      docker('rm', '-f', container);
    } catch {
      // not there
    }
  }
}

async function up({ name, dir }) {
  remove(name);
  rmSync(dir, { recursive: true, force: true });
  const config = join(dir, 'mosquitto');
  mkdirSync(config, { recursive: true });

  const collectorPassword = randomBytes(12).toString('hex');
  const devicePassword = randomBytes(12).toString('hex');
  const influxPassword = randomBytes(12).toString('hex');

  writeFileSync(
    join(config, 'mosquitto.conf'),
    [
      'per_listener_settings true',
      'persistence true',
      'persistence_location /mosquitto/data/',
      'log_dest stdout',
      'log_type all',
      'listener 1883',
      'listener_allow_anonymous false',
      'password_file /mosquitto/config/pwfile',
      'acl_file /mosquitto/config/acl',
      'listener 9001',
      'protocol websockets',
      'listener_allow_anonymous true',
      'acl_file /mosquitto/config/acl-websocket',
      '',
    ].join('\n'),
  );
  writeFileSync(
    join(config, 'acl'),
    [
      'user sensors-collector',
      'topic read #',
      'topic write leoiot/room-climate/#',
      '# stands in for the sensor box nili3',
      'user nili3-sim',
      'topic readwrite #',
      '',
    ].join('\n'),
  );
  writeFileSync(join(config, 'acl-websocket'), 'topic read leoiot/room-climate/#\n');
  for (const [i, [user, password]] of [['sensors-collector', collectorPassword], ['nili3-sim', devicePassword]].entries()) {
    docker('run', '--rm', '-v', `${config}:/c`, MOSQUITTO_IMAGE, 'mosquitto_passwd', '-b', ...(i === 0 ? ['-c'] : []), '/c/pwfile', user, password);
  }

  const mqttPort = await freePort();
  const wsPort = await freePort();
  const influxPort = await freePort();

  docker(
    'run', '-d', '--name', `${name}-mosquitto`,
    '-p', `127.0.0.1:${mqttPort}:1883`, '-p', `127.0.0.1:${wsPort}:9001`,
    '-v', `${config}:/mosquitto/config:ro`,
    MOSQUITTO_IMAGE,
  );
  docker(
    'run', '-d', '--name', `${name}-influxdb`,
    '-p', `127.0.0.1:${influxPort}:8086`,
    '-e', 'DOCKER_INFLUXDB_INIT_MODE=setup',
    '-e', 'DOCKER_INFLUXDB_INIT_USERNAME=admin',
    '-e', `DOCKER_INFLUXDB_INIT_PASSWORD=${influxPassword}`,
    '-e', 'DOCKER_INFLUXDB_INIT_ORG=leoiot',
    '-e', 'DOCKER_INFLUXDB_INIT_BUCKET=server_data',
    '-e', `DOCKER_INFLUXDB_INIT_ADMIN_TOKEN=${TEST_INFLUX_TOKEN}`,
    INFLUX_IMAGE,
  );

  await waitFor('Mosquitto', () => tcpOpen(mqttPort));
  await waitFor('InfluxDB', async () => {
    const health = await fetch(`http://127.0.0.1:${influxPort}/health`);
    if (!health.ok) return false;
    // The setup step creates the organisation and bucket after the health endpoint is up.
    const buckets = await fetch(`http://127.0.0.1:${influxPort}/api/v2/buckets?name=server_data`, {
      headers: { Authorization: `Token ${TEST_INFLUX_TOKEN}` },
    });
    return buckets.ok;
  });

  const envFile = join(dir, 'collector.env');
  writeFileSync(
    envFile,
    [
      '# Throwaway test values for the local stack. Source it: set -a; . collector.env; set +a',
      `SENSORS_INFLUX_URL=http://127.0.0.1:${influxPort}`,
      `SENSORS_INFLUX_TOKEN=${TEST_INFLUX_TOKEN}`,
      `SENSORS_MQTT_URL=mqtt://127.0.0.1:${mqttPort}`,
      'SENSORS_MQTT_USER=sensors-collector',
      `SENSORS_MQTT_PASSWORD=${collectorPassword}`,
      `SENSORS_HEALTH_FILE=${join(dir, 'health.json')}`,
      '# the account the publisher script uses in place of the sensor box',
      'DEVICE_MQTT_USER=nili3-sim',
      `DEVICE_MQTT_PASSWORD=${devicePassword}`,
      '',
    ].join('\n'),
  );

  const stack = { name, dir, envFile, mqttPort, wsPort, influxPort, influxToken: TEST_INFLUX_TOKEN };
  writeFileSync(join(dir, 'stack.json'), JSON.stringify(stack, null, 2));
  return stack;
}

function down({ name, dir }) {
  remove(name);
  rmSync(dir, { recursive: true, force: true });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [command, ...rest] = process.argv.slice(2);
  try {
    if (command === 'up') {
      console.log(JSON.stringify(await up(options(rest)), null, 2));
    } else if (command === 'down') {
      down(options(rest));
      console.log('stack removed');
    } else {
      console.error('usage: node scripts/stack.mjs up|down [--name <name>] [--dir <dir>]');
      process.exitCode = 2;
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
