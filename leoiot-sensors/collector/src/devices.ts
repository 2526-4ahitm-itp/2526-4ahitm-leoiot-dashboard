// The device mapping (spec sensors/collector: "Devices are read through a
// mapping"): which devices are read, in which room, and on which topic each
// quantity arrives. The mapping holds no credentials.
import { readFile } from 'node:fs/promises';

export const QUANTITIES = ['co2', 'temperature', 'humidity'] as const;
export type Quantity = (typeof QUANTITIES)[number];

export const SOURCES = ['sensor', 'simulated'] as const;
export type Source = (typeof SOURCES)[number];

export interface Device {
  device: string;
  room: string;
  source: Source;
  topics: Partial<Record<Quantity, string>>;
}

/** What a topic of the mapping stands for. */
export interface TopicEntry {
  device: Device;
  quantity: Quantity;
}

export class MappingError extends Error {
  constructor(public readonly problems: string[]) {
    super(`Invalid device mapping: ${problems.join('; ')}`);
    this.name = 'MappingError';
  }
}

/** Room id rule of platform/data-contract: letters, digits and dots only. */
const ROOM_ID = /^[A-Za-z0-9.]+$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Checks the parsed content of devices.json; throws a MappingError naming every invalid entry. */
export function parseDevices(raw: unknown): Device[] {
  const problems: string[] = [];
  if (!isRecord(raw) || !Array.isArray(raw.devices)) {
    throw new MappingError(['the file must be an object with a "devices" array']);
  }
  if (raw.devices.length === 0) {
    throw new MappingError(['"devices" must list at least one device']);
  }

  const devices: Device[] = [];
  const names = new Map<string, number>();
  const topicOwner = new Map<string, string>();

  raw.devices.forEach((entry: unknown, index: number) => {
    const label = (name?: string) => `devices[${index}]${name ? ` (${JSON.stringify(name)})` : ''}`;
    if (!isRecord(entry)) {
      problems.push(`${label()}: must be an object`);
      return;
    }
    const name = entry.device;
    if (typeof name !== 'string' || name === '' || /[\u0000-\u001f\u007f]/.test(name)) {
      problems.push(`${label()}: "device" must be a non-empty text without control characters`);
      return;
    }
    const where = label(name);
    let ok = true;

    const first = names.get(name);
    if (first !== undefined) {
      problems.push(`${where}: device name already used by devices[${first}]`);
      ok = false;
    } else {
      names.set(name, index);
    }

    const room = entry.room;
    if (typeof room !== 'string' || !ROOM_ID.test(room)) {
      problems.push(
        `${where}: room ${JSON.stringify(room)} breaks the room id rule (letters, digits and dots only)`,
      );
      ok = false;
    }

    const source = entry.source;
    if (typeof source !== 'string' || !(SOURCES as readonly string[]).includes(source)) {
      problems.push(`${where}: source ${JSON.stringify(source)} must be "sensor" or "simulated"`);
      ok = false;
    }

    const topics: Partial<Record<Quantity, string>> = {};
    if (!isRecord(entry.topics) || Object.keys(entry.topics).length === 0) {
      problems.push(`${where}: "topics" must name at least one quantity`);
      ok = false;
    } else {
      for (const [quantity, topic] of Object.entries(entry.topics)) {
        if (!(QUANTITIES as readonly string[]).includes(quantity)) {
          problems.push(`${where}: unknown quantity ${JSON.stringify(quantity)} (use co2, temperature, humidity)`);
          ok = false;
        } else if (typeof topic !== 'string' || topic === '') {
          problems.push(`${where}: topic of ${quantity} must be a non-empty text`);
          ok = false;
        } else if (/[+#\u0000]/.test(topic)) {
          problems.push(`${where}: topic of ${quantity} must be an exact topic, not a pattern: ${JSON.stringify(topic)}`);
          ok = false;
        } else {
          const owner = topicOwner.get(topic);
          if (owner !== undefined) {
            problems.push(`${where}: topic ${JSON.stringify(topic)} is already mapped (${owner}); one topic carries one quantity`);
            ok = false;
          } else {
            topicOwner.set(topic, `${name} ${quantity}`);
            topics[quantity as Quantity] = topic;
          }
        }
      }
    }

    if (ok) devices.push({ device: name, room: room as string, source: source as Source, topics });
  });

  if (problems.length > 0) throw new MappingError(problems);
  return devices;
}

/** Reads and checks a mapping file. */
export async function loadDevices(file: string | URL): Promise<Device[]> {
  let text: string;
  try {
    text = await readFile(file, 'utf8');
  } catch (error) {
    throw new MappingError([`cannot read ${String(file)}: ${(error as Error).message}`]);
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (error) {
    throw new MappingError([`${String(file)} is not valid JSON: ${(error as Error).message}`]);
  }
  return parseDevices(raw);
}

/** Topic -> device and quantity, for the subscription and for dispatching messages. */
export function topicTable(devices: Device[]): Map<string, TopicEntry> {
  const table = new Map<string, TopicEntry>();
  for (const device of devices) {
    for (const quantity of QUANTITIES) {
      const topic = device.topics[quantity];
      if (topic !== undefined) table.set(topic, { device, quantity });
    }
  }
  return table;
}
