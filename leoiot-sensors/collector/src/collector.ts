// Wiring: broker messages become points (database) and live messages (broker).
import { createBroker, type MqttConnect } from './broker.js';
import { createWriteBuffer } from './buffer.js';
import { describeUrl, type Config } from './config.js';
import { topicTable, type Device } from './devices.js';
import { createHealth, writeStatusFile } from './health.js';
import { createInflux } from './influx.js';
import { createTimestamps, toLine } from './line.js';
import { createLiveState } from './live.js';
import type { Log } from './log.js';
import { parseValue, quoteReceived } from './reading.js';

export interface CollectorOptions {
  config: Config;
  devices: Device[];
  log: Log;
  now?: () => number;
  connect?: MqttConnect;
  fetchFn?: typeof fetch;
}

export function startCollector(options: CollectorOptions) {
  const { config, devices, log } = options;
  const now = options.now ?? Date.now;
  const table = topicTable(devices);
  const live = createLiveState();
  const stamp = createTimestamps();
  const health = createHealth(config, now);

  const influx = createInflux({
    url: config.influxUrl,
    org: config.influxOrg,
    bucket: config.influxBucket,
    token: config.influxToken,
    fetchFn: options.fetchFn,
  });
  const buffer = createWriteBuffer({
    write: (lines) => influx.write(lines),
    maxAgeMs: config.bufferMaxAgeMs,
    now,
    log,
    onWriteOk: () => health.writeOk(),
    onWriteFail: () => health.writeFailed(),
  });

  let retainedIgnored = 0;

  function handle(topic: string, payload: Buffer, retained: boolean): void {
    const entry = table.get(topic);
    // Only mapped topics are subscribed; this guards against anything else.
    if (!entry) return;
    // The broker replays the last value of a retained device topic on every
    // subscribe. It is old, so it is not a delivery: stamping it with the
    // current time would invent a reading.
    if (retained) {
      retainedIgnored++;
      if (retainedIgnored === 1) log(`Ignoring retained device message(s), e.g. on ${topic}: replayed old value, not a delivery`);
      return;
    }
    const receivedMs = now();
    const text = payload.toString('utf8');
    const parsed = parseValue(entry.quantity, text);
    if (!parsed.ok) {
      log(`Dropped value of device ${entry.device.device}, ${entry.quantity}: received ${quoteReceived(text)} (${parsed.reason})`);
      return;
    }
    buffer.add({
      line: toLine(entry.device, entry.quantity, parsed.value, stamp(receivedMs)),
      receivedMs,
    });
    broker.publish(live.update(entry.device, entry.quantity, parsed.value, receivedMs));
  }

  const broker = createBroker({
    url: config.mqttUrl,
    username: config.mqttUser,
    password: config.mqttPassword,
    reconnectMs: config.mqttReconnectMs,
    topics: [...table.keys()],
    log,
    onMessage: handle,
    onConnected: () => health.brokerConnected(),
    onDisconnected: () => health.brokerLost(),
    connect: options.connect,
  });

  async function writeHealth(): Promise<void> {
    try {
      await writeStatusFile(config.healthFile, health.status());
    } catch (error) {
      log(`Status file not written: ${(error as Error).message}`);
    }
  }

  log(
    `Start: ${devices.length} device(s), broker ${describeUrl(config.mqttUrl)}, ` +
      `database ${describeUrl(config.influxUrl)} bucket ${config.influxBucket}`,
  );
  broker.start();
  void writeHealth();
  const flushTimer = setInterval(() => void buffer.flush(), config.flushIntervalMs);
  const healthTimer = setInterval(() => void writeHealth(), config.healthIntervalMs);

  return {
    flush: () => buffer.flush(),
    queued: () => buffer.size(),
    status: () => health.status(),
    /** Stops the timers, writes what is queued once more and closes the broker connection. */
    async stop(): Promise<void> {
      clearInterval(flushTimer);
      clearInterval(healthTimer);
      await broker.close();
      await buffer.flush();
      await writeHealth();
    },
  };
}

export type Collector = ReturnType<typeof startCollector>;
