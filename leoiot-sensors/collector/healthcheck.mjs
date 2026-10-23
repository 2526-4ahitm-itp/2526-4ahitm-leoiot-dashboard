// Container health check: the collector writes its verdict to a status file every
// few seconds (src/health.ts). Healthy when the file says so and is fresh.
import { readFileSync } from 'node:fs';

const file = process.env.SENSORS_HEALTH_FILE || '/tmp/collector-health.json';
const maxAgeMs = Number(process.env.SENSORS_HEALTH_MAX_AGE_MS) || 60_000;
try {
  const status = JSON.parse(readFileSync(file, 'utf8'));
  if (status.healthy !== true) process.exit(1);
  if (!Number.isFinite(status.updatedAt) || Date.now() - status.updatedAt > maxAgeMs) process.exit(1);
} catch {
  process.exit(1);
}
