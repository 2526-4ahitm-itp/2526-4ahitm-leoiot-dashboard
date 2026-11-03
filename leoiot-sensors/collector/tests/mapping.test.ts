import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BUNDLED_DEVICES_FILE } from '../src/config.js';
import { loadDevices, MappingError, parseDevices, topicTable } from '../src/devices.js';
import { NILI3_CO2, NILI3_HUMIDITY, NILI3_TEMPERATURE, nili3Mapping } from './helpers.js';

function mapping(change: (device: Record<string, any>) => void, extra: unknown[] = []) {
  const copy = structuredClone(nili3Mapping) as { devices: Record<string, any>[] };
  change(copy.devices[0]!);
  copy.devices.push(...(extra as Record<string, any>[]));
  return copy;
}

function problemsOf(raw: unknown): string[] {
  try {
    parseDevices(raw);
  } catch (error) {
    expect(error).toBeInstanceOf(MappingError);
    return (error as MappingError).problems;
  }
  throw new Error('mapping was accepted');
}

describe('Devices are read through a mapping', () => {
  it('the bundled mapping holds nili3 in room 105 with source sensor and its three exact topics', async () => {
    const devices = await loadDevices(BUNDLED_DEVICES_FILE);
    expect(devices).toEqual([
      {
        device: 'nili3',
        room: '105',
        source: 'sensor',
        topics: { co2: NILI3_CO2, temperature: NILI3_TEMPERATURE, humidity: NILI3_HUMIDITY },
      },
    ]);
  });

  it('the bundled mapping contains no credentials', () => {
    const text = readFileSync(BUNDLED_DEVICES_FILE, 'utf8').toLowerCase();
    for (const word of ['password', 'token', 'secret', 'user']) expect(text).not.toContain(word);
  });

  it('maps each topic to its device and quantity', () => {
    const table = topicTable(parseDevices(nili3Mapping));
    expect([...table.keys()].sort()).toEqual([NILI3_CO2, NILI3_HUMIDITY, NILI3_TEMPERATURE].sort());
    expect(table.get(NILI3_CO2)).toMatchObject({ quantity: 'co2', device: { device: 'nili3', room: '105', source: 'sensor' } });
  });

  it('the legacy simulator topic is not in the table', () => {
    expect(topicTable(parseDevices(nili3Mapping)).has('nili3/sensor/105_co2/state')).toBe(false);
  });

  it('accepts room ids with letters and dots and a simulated source', () => {
    const devices = parseDevices(
      mapping(
        (d) => {
          d.room = 'U74.1';
          d.source = 'simulated';
        },
        [{ device: 'x1', room: 'UBiolab', source: 'sensor', topics: { co2: 'x1/co2' } }],
      ),
    );
    expect(devices.map((d) => d.room)).toEqual(['U74.1', 'UBiolab']);
  });

  describe('Invalid mapping', () => {
    for (const room of ['10 5', '1/05', '105-a', 'Ü10', '', 'a+b', 'a#']) {
      it(`rejects the room id ${JSON.stringify(room)} and names the entry`, () => {
        const problems = problemsOf(mapping((d) => (d.room = room)));
        expect(problems).toHaveLength(1);
        expect(problems[0]).toContain('devices[0] ("nili3")');
        expect(problems[0]).toContain('room id rule');
      });
    }

    it('rejects a device named twice', () => {
      const problems = problemsOf(mapping(() => {}, [{ device: 'nili3', room: '106', source: 'sensor', topics: { co2: 'other/co2' } }]));
      expect(problems).toHaveLength(1);
      expect(problems[0]).toContain('devices[1] ("nili3")');
      expect(problems[0]).toContain('already used');
    });

    it('rejects a source other than sensor or simulated', () => {
      const problems = problemsOf(mapping((d) => (d.source = 'real')));
      expect(problems[0]).toContain('devices[0] ("nili3")');
      expect(problems[0]).toContain('"real"');
    });

    it('rejects one topic mapped to two quantities', () => {
      const problems = problemsOf(mapping((d) => (d.topics.humidity = NILI3_CO2)));
      expect(problems).toHaveLength(1);
      expect(problems[0]).toContain('already mapped');
    });

    it('rejects one topic used by two devices', () => {
      const problems = problemsOf(mapping(() => {}, [{ device: 'b', room: '106', source: 'sensor', topics: { co2: NILI3_CO2 } }]));
      expect(problems[0]).toContain('devices[1] ("b")');
      expect(problems[0]).toContain('already mapped');
    });

    it('rejects a topic pattern, because only exact topics are subscribed', () => {
      expect(problemsOf(mapping((d) => (d.topics.co2 = 'nili3/sensor/+/state')))[0]).toContain('not a pattern');
      expect(problemsOf(mapping((d) => (d.topics.co2 = 'nili3/sensor/#')))[0]).toContain('not a pattern');
    });

    it('rejects an unknown quantity, a missing topics object and a bad shape', () => {
      expect(problemsOf(mapping((d) => (d.topics.pressure = 'x/p')))[0]).toContain('unknown quantity');
      expect(problemsOf(mapping((d) => (d.topics = {})))[0]).toContain('"topics"');
      expect(problemsOf({})[0]).toContain('"devices" array');
      expect(problemsOf({ devices: [] })[0]).toContain('at least one');
      expect(problemsOf({ devices: [42] })[0]).toContain('devices[0]');
    });

    it('reports every invalid entry, not only the first', () => {
      const problems = problemsOf(
        mapping((d) => (d.room = 'a b'), [{ device: 'c', room: '1', source: 'fake', topics: { co2: 'c/co2' } }]),
      );
      expect(problems).toHaveLength(2);
    });

    it('a file that is not JSON or does not exist is a mapping error, too', async () => {
      await expect(loadDevices('/nonexistent/devices.json')).rejects.toBeInstanceOf(MappingError);
      const file = join(mkdtempSync(join(tmpdir(), 'sensors-map-')), 'devices.json');
      writeFileSync(file, '{ not json');
      await expect(loadDevices(file)).rejects.toThrow(/not valid JSON/);
    });
  });
});
