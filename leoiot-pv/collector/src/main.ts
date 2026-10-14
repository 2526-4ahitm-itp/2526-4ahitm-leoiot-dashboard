// Einstiegspunkt: Konfiguration lesen, Adapter bauen, Schleife starten.
import { mkdir, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { createBroker } from './adapters/broker.js';
import { createCloud } from './adapters/cloud.js';
import { createInflux } from './adapters/influx.js';
import { ConfigError, loadConfig, type Config } from './config.js';
import { createLoop } from './loop.js';
import { consoleLog, type Log } from './log.js';

/** Schreibt den Zeitpunkt der letzten Lieferung (ms seit Epoche) atomar in die Datei. */
export function createHealthWriter(file: string) {
  return async (nowMs: number): Promise<void> => {
    await mkdir(dirname(file), { recursive: true });
    const temp = `${file}.tmp`;
    await writeFile(temp, String(nowMs));
    await rename(temp, file);
  };
}

export function startCollector(config: Config, log: Log) {
  const broker = createBroker({
    url: config.mqttUrl,
    username: config.mqttUser,
    password: config.mqttPassword,
    log,
  });
  // Ohne Veröffentlichen wird der Broker gar nicht angefasst.
  if (config.publish) broker.start();

  const loop = createLoop({
    plantId: config.plantId,
    intervalMs: config.intervalMs,
    publish: config.publish,
    cloud: createCloud({
      baseUrl: config.solaxBaseUrl,
      clientId: config.solaxClientId,
      clientSecret: config.solaxClientSecret,
      username: config.solaxUsername,
      password: config.solaxPassword,
      plantId: config.plantId,
    }),
    influx: createInflux({
      url: config.influxUrl,
      org: config.influxOrg,
      bucket: config.influxBucket,
      token: config.influxToken,
    }),
    broker,
    markDelivered: createHealthWriter(config.healthFile),
    log,
  });
  loop.start();

  return {
    async stop(): Promise<void> {
      await loop.stop();
      await broker.close();
    },
  };
}

/** Liefert den Exit-Code, wenn die Konfiguration nicht reicht, sonst null (läuft). */
export function bootstrap(
  env: Record<string, string | undefined>,
  log: Log,
  onSignal: (handler: () => void) => void,
  exit: (code: number) => void,
): number | null {
  let config: Config;
  try {
    config = loadConfig(env);
  } catch (error) {
    if (error instanceof ConfigError) {
      console.error(`Konfigurationsfehler: ${error.message}`);
      exit(1);
      return 1;
    }
    throw error;
  }
  log(
    `Start: Bucket ${config.influxBucket}, Veröffentlichen ${config.publish ? 'an' : 'aus'}, ` +
      `Takt ${config.intervalMs} ms`,
  );
  const collector = startCollector(config, log);
  onSignal(() => {
    log('Beende sauber');
    collector.stop().finally(() => exit(0));
  });
  return null;
}

// Nur starten, wenn die Datei direkt ausgeführt wird (nicht beim Import in Tests).
if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  bootstrap(
    process.env,
    consoleLog,
    (handler) => {
      process.once('SIGTERM', handler);
      process.once('SIGINT', handler);
    },
    (code) => process.exit(code),
  );
}
