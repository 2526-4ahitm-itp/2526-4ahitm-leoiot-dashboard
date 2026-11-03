// Task 2.6: the container turns unhealthy when the database (or the broker) is gone
// for longer than the limit and healthy again after the first successful write.
// The limits are shortened for the test (6 s instead of 5 minutes, 4 s instead of 2).
// The real image is built and run, so Docker's own HEALTHCHECK decides.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  collectorDir,
  docker,
  publishAsDevice,
  queryRoomClimate,
  sleep,
  startStack,
  stopStack,
  waitFor,
  waitForBroker,
  waitForInflux,
  type Stack,
} from './support.js';

let stack: Stack;
let container: string;
const IMAGE = 'leoiot-sensors-collector:integration-test';

const health = () => docker('inspect', '-f', '{{.State.Health.Status}}', container);

beforeAll(async () => {
  stack = startStack('health');
  container = `${stack.name}-collector`;
  docker('build', '-t', IMAGE, collectorDir);
  const host = 'host.docker.internal';
  docker(
    'run', '-d', '--name', container, '--add-host', `${host}:host-gateway`,
    '-e', `SENSORS_INFLUX_URL=http://${host}:${stack.influxPort}`,
    '-e', `SENSORS_INFLUX_TOKEN=${stack.influxToken}`,
    '-e', `SENSORS_MQTT_URL=mqtt://${host}:${stack.mqttPort}`,
    '-e', `SENSORS_MQTT_USER=${stack.env.SENSORS_MQTT_USER}`,
    '-e', `SENSORS_MQTT_PASSWORD=${stack.env.SENSORS_MQTT_PASSWORD}`,
    '-e', 'SENSORS_FLUSH_INTERVAL_MS=500',
    '-e', 'SENSORS_HEALTH_INTERVAL_MS=1000',
    '-e', 'SENSORS_MQTT_RECONNECT_MS=500',
    '-e', 'SENSORS_HEALTH_WRITE_FAIL_MS=6000',
    '-e', 'SENSORS_HEALTH_BROKER_DOWN_MS=4000',
    '--health-interval', '2s', '--health-timeout', '5s', '--health-retries', '1', '--health-start-period', '0s',
    IMAGE,
  );
}, 300_000);

afterAll(() => {
  try {
    docker('rm', '-f', container);
  } catch {
    // already gone
  }
  try {
    docker('rmi', IMAGE);
  } catch {
    // still in use or gone
  }
  stopStack(stack);
});

describe('Health is reported (container, shortened limits)', () => {
  it('becomes healthy once connected', async () => {
    await waitFor('healthy', () => health() === 'healthy', 60_000);
  });

  it('Box switched off: stays healthy while the device delivers nothing', async () => {
    await sleep(8000);
    expect(health()).toBe('healthy');
  });

  it('Database down: unhealthy after the limit, readings kept; healthy again after the first successful write', async () => {
    const sent: number[] = [];
    docker('stop', `${stack.name}-influxdb`);
    const outageStart = Date.now();
    // The box keeps delivering every second while the database is down.
    for (let i = 0; i < 9; i++) {
      await publishAsDevice(stack, 'nili3/sensor/nili3_co2/state', String(800 + i), false);
      sent.push(800 + i);
      await sleep(1000);
    }
    await waitFor('unhealthy', () => health() === 'unhealthy', 30_000);
    expect(Date.now() - outageStart).toBeGreaterThan(6000);

    docker('start', `${stack.name}-influxdb`);
    await waitForInflux(stack);
    await waitFor('healthy again', () => health() === 'healthy', 60_000);

    const rows = await waitFor('all kept readings', async () => {
      const r = (await queryRoomClimate(stack)).filter((x) => x.field === 'co2');
      return r.length >= sent.length ? r : null;
    });
    expect(rows.map((r) => r.value)).toEqual(sent);
    // Original receipt times: about a second apart, not all at the time of recovery.
    const times = rows.map((r) => Date.parse(r.time));
    expect(times.at(-1)! - times[0]!).toBeGreaterThan(7000);
  });

  it('Broker gone: unhealthy after the limit, healthy again after the reconnect', async () => {
    docker('stop', `${stack.name}-mosquitto`);
    await waitFor('unhealthy', () => health() === 'unhealthy', 30_000);
    docker('start', `${stack.name}-mosquitto`);
    await waitForBroker(stack);
    await waitFor('healthy again', () => health() === 'healthy', 60_000);
  });
});
