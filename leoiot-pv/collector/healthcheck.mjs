// Healthcheck des Containers: gesund, wenn die letzte Lieferung höchstens 5 Minuten her ist.
import { readFileSync } from 'node:fs';

const file = process.env.COLLECTOR_HEALTH_FILE || '/tmp/collector-last-delivery';
const maxAgeMs = 5 * 60 * 1000;
try {
  const last = Number(readFileSync(file, 'utf8').trim());
  if (!Number.isFinite(last) || Date.now() - last > maxAgeMs) process.exit(1);
} catch {
  process.exit(1);
}
