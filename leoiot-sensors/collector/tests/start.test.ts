import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { REQUIRED_VARIABLES } from '../src/config.js';
import { bootstrap } from '../src/main.js';
import { logCollector, nili3Mapping, TEST_MQTT_PASSWORD, TEST_MQTT_USER, TEST_TOKEN } from './helpers.js';

const complete: Record<string, string> = {
  SENSORS_INFLUX_TOKEN: TEST_TOKEN,
  SENSORS_MQTT_USER: TEST_MQTT_USER,
  SENSORS_MQTT_PASSWORD: TEST_MQTT_PASSWORD,
};

describe('Start', () => {
  for (const name of REQUIRED_VARIABLES) {
    it(`Token missing: without ${name} the program exits at once with code 1 and names the variable, no credential value`, async () => {
      const env = { ...complete };
      delete env[name];
      const codes: number[] = [];
      const { log, lines } = logCollector();
      const result = await bootstrap(env, log, () => {}, (c) => codes.push(c));
      expect(result).toBe(1);
      expect(codes).toEqual([1]);
      const text = lines.join('\n');
      expect(text).toContain(name);
      for (const value of Object.values(env)) expect(text).not.toContain(value);
    });
  }

  it('Invalid mapping: the program does not start and its log names the invalid entry', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'sensors-start-'));
    const file = join(dir, 'devices.json');
    const bad = structuredClone(nili3Mapping);
    bad.devices[0]!.room = 'a/b';
    writeFileSync(file, JSON.stringify(bad));
    const codes: number[] = [];
    const { log, lines } = logCollector();
    const result = await bootstrap({ ...complete, SENSORS_DEVICES_FILE: file }, log, () => {}, (c) => codes.push(c));
    expect(result).toBe(1);
    expect(codes).toEqual([1]);
    expect(lines.join('\n')).toContain('devices[0] ("nili3")');
    expect(lines.join('\n')).not.toContain(TEST_TOKEN);
  });

  it('the bundled mapping file ships next to the compiled program (path used by the container)', () => {
    const text = readFileSync(new URL('../devices.json', import.meta.url), 'utf8');
    expect(JSON.parse(text).devices[0].device).toBe('nili3');
  });
});
