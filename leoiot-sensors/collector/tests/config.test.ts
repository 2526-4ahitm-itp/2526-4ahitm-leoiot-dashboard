import { describe, expect, it } from 'vitest';
import { BUNDLED_DEVICES_FILE, ConfigError, describeUrl, loadConfig, REQUIRED_VARIABLES } from '../src/config.js';
import { TEST_MQTT_PASSWORD, TEST_MQTT_USER, TEST_TOKEN } from './helpers.js';

const complete: Record<string, string> = {
  SENSORS_INFLUX_TOKEN: TEST_TOKEN,
  SENSORS_MQTT_USER: TEST_MQTT_USER,
  SENSORS_MQTT_PASSWORD: TEST_MQTT_PASSWORD,
};

describe('Credentials come from the environment', () => {
  it('reads a complete environment with the documented defaults', () => {
    const c = loadConfig(complete);
    expect(c.influxUrl).toBe('http://influxdb:8086');
    expect(c.influxOrg).toBe('leoiot');
    expect(c.influxBucket).toBe('server_data');
    expect(c.mqttUrl).toBe('mqtt://mosquitto:1883');
    expect(c.devicesFile).toBe(BUNDLED_DEVICES_FILE);
    expect(c.healthFile).toBe('/tmp/collector-health.json');
    expect(c.flushIntervalMs).toBe(2000);
    expect(c.bufferMaxAgeMs).toBe(3_600_000);
    expect(c.healthBrokerDownMs).toBe(120_000);
    expect(c.healthWriteFailMs).toBe(300_000);
  });

  it('takes optional values from the environment', () => {
    const c = loadConfig({
      ...complete,
      SENSORS_INFLUX_URL: 'http://localhost:8086/',
      SENSORS_INFLUX_ORG: 'o',
      SENSORS_INFLUX_BUCKET: 'b',
      SENSORS_MQTT_URL: 'mqtt://localhost:1883',
      SENSORS_DEVICES_FILE: '/etc/devices.json',
      SENSORS_HEALTH_FILE: '/tmp/h.json',
    });
    expect([c.influxUrl, c.influxOrg, c.influxBucket, c.mqttUrl, c.devicesFile, c.healthFile]).toEqual([
      'http://localhost:8086',
      'o',
      'b',
      'mqtt://localhost:1883',
      '/etc/devices.json',
      '/tmp/h.json',
    ]);
  });

  it('rejects an interval that is not a positive whole number', () => {
    expect(() => loadConfig({ ...complete, SENSORS_FLUSH_INTERVAL_MS: 'abc' })).toThrow(/SENSORS_FLUSH_INTERVAL_MS/);
    expect(() => loadConfig({ ...complete, SENSORS_HEALTH_WRITE_FAIL_MS: '0' })).toThrow(/SENSORS_HEALTH_WRITE_FAIL_MS/);
  });

  for (const name of REQUIRED_VARIABLES) {
    describe(`Token missing: ${name}`, () => {
      const env = { ...complete };
      delete env[name];

      it('is refused with a message naming the variable and no credential value', () => {
        let error: unknown;
        try {
          loadConfig(env);
        } catch (e) {
          error = e;
        }
        expect(error).toBeInstanceOf(ConfigError);
        const message = (error as Error).message;
        expect(message).toContain(name);
        for (const value of Object.values(env)) expect(message).not.toContain(value);
      });
    });
  }

  it('treats a blank value as missing and names every missing variable at once', () => {
    const env = { ...complete, SENSORS_INFLUX_TOKEN: '  ' };
    delete (env as Record<string, string | undefined>).SENSORS_MQTT_PASSWORD;
    expect(() => loadConfig(env)).toThrow('SENSORS_INFLUX_TOKEN, SENSORS_MQTT_PASSWORD');
  });

  it('does not echo an invalid broker address, which could carry a password', () => {
    const bad = 'not a url with user:password-in-url@';
    try {
      loadConfig({ ...complete, SENSORS_MQTT_URL: bad });
    } catch (e) {
      expect((e as Error).message).not.toContain('password-in-url');
      return;
    }
    throw new Error('accepted');
  });

  it('describes a broker address without its user info', () => {
    expect(describeUrl('mqtt://user:secret@mosquitto:1883')).toBe('mqtt://mosquitto:1883');
  });
});
