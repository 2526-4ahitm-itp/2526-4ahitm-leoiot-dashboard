import { describe, expect, it } from 'vitest';
import { bootstrap } from '../src/main.js';
import { ConfigError, loadConfig, REQUIRED_VARIABLES } from '../src/config.js';

const complete: Record<string, string> = {
  COLLECTOR_SOLAX_CLIENT_ID: 'test-client',
  COLLECTOR_SOLAX_CLIENT_SECRET: 'test-secret',
  COLLECTOR_SOLAX_USERNAME: 'test-user',
  COLLECTOR_SOLAX_PASSWORD: 'test-pass',
  COLLECTOR_SOLAX_PLANT_ID: 'test-plant',
  COLLECTOR_INFLUX_TOKEN: 'test-token',
  COLLECTOR_MQTT_USER: 'test-mqtt-user',
  COLLECTOR_MQTT_PASSWORD: 'test-mqtt-pass',
};

describe('Konfiguration', () => {
  it('liest eine vollständige Umgebung mit den Standardwerten', () => {
    const c = loadConfig(complete);
    expect(c.influxBucket).toBe('pv_shadow');
    expect(c.publish).toBe(false);
    expect(c.influxUrl).toBe('http://influxdb:8086');
    expect(c.influxOrg).toBe('leoiot');
    expect(c.mqttUrl).toBe('mqtt://mosquitto:1883');
    expect(c.solaxBaseUrl).toBe('https://openapi-eu.solaxcloud.com');
    expect(c.intervalMs).toBe(60000);
  });

  it('schaltet Veröffentlichen nur mit 1 oder true ein', () => {
    expect(loadConfig({ ...complete, COLLECTOR_PUBLISH: '1' }).publish).toBe(true);
    expect(loadConfig({ ...complete, COLLECTOR_PUBLISH: 'true' }).publish).toBe(true);
    expect(loadConfig({ ...complete, COLLECTOR_PUBLISH: 'yes' }).publish).toBe(false);
    expect(loadConfig({ ...complete, COLLECTOR_PUBLISH: '0' }).publish).toBe(false);
  });

  it('weist ein ungültiges Intervall ab', () => {
    expect(() => loadConfig({ ...complete, COLLECTOR_INTERVAL_MS: 'abc' })).toThrow(/COLLECTOR_INTERVAL_MS/);
  });

  for (const name of REQUIRED_VARIABLES) {
    it(`nennt die fehlende Variable ${name}`, () => {
      const env = { ...complete };
      delete env[name];
      expect(() => loadConfig(env)).toThrow(ConfigError);
      expect(() => loadConfig(env)).toThrow(name);
    });

    it(`beendet den Start mit Exit-Code 1, wenn ${name} leer ist`, () => {
      const codes: number[] = [];
      const result = bootstrap({ ...complete, [name]: '  ' }, () => {}, () => {}, (c) => codes.push(c));
      expect(result).toBe(1);
      expect(codes).toEqual([1]);
    });
  }
});
