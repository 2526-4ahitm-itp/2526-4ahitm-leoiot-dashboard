// Entry point: read the configuration and the mapping, then start.
import { fileURLToPath } from 'node:url';
import { startCollector } from './collector.js';
import { ConfigError, loadConfig } from './config.js';
import { loadDevices, MappingError } from './devices.js';
import { consoleLog, type Log } from './log.js';

/** Starts the collector; resolves to an exit code when it cannot start, otherwise null (running). */
export async function bootstrap(
  env: Record<string, string | undefined>,
  log: Log,
  onSignal: (handler: () => void) => void,
  exit: (code: number) => void,
): Promise<number | null> {
  try {
    const config = loadConfig(env);
    const devices = await loadDevices(config.devicesFile);
    const collector = startCollector({ config, devices, log });
    onSignal(() => {
      log('Stopping');
      collector.stop().finally(() => exit(0));
    });
    return null;
  } catch (error) {
    if (error instanceof ConfigError) {
      log(`Configuration error: ${error.message}`);
    } else if (error instanceof MappingError) {
      log(`Configuration error: invalid device mapping`);
      for (const problem of error.problems) log(`  ${problem}`);
    } else {
      throw error;
    }
    exit(1);
    return 1;
  }
}

// Run only when started directly (not when a test imports this file).
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  void bootstrap(
    process.env,
    consoleLog,
    (handler) => {
      process.once('SIGTERM', handler);
      process.once('SIGINT', handler);
    },
    (code) => process.exit(code),
  );
}
