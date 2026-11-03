import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createHealth, writeStatusFile } from '../src/health.js';

const limits = { healthBrokerDownMs: 120_000, healthWriteFailMs: 300_000 };
const MIN = 60_000;

function setup() {
  const clock = { t: 10_000_000 };
  const health = createHealth(limits, () => clock.t);
  return { clock, health };
}

describe('Health is reported (logic)', () => {
  it('is healthy while connected and writing', () => {
    const { health, clock } = setup();
    health.brokerConnected();
    clock.t += 60 * MIN;
    expect(health.status().healthy).toBe(true);
  });

  it('Box switched off: a silent device changes nothing, only broker and writes count', () => {
    const { health, clock } = setup();
    health.brokerConnected();
    health.writeOk();
    clock.t += 60 * MIN; // no reading, no write attempt for an hour
    expect(health.status()).toMatchObject({ healthy: true, reason: 'ok' });
  });

  it('is unhealthy once the broker has been gone for more than two minutes', () => {
    const { health, clock } = setup();
    health.brokerConnected();
    health.brokerLost();
    clock.t += 2 * MIN;
    expect(health.status().healthy).toBe(true);
    clock.t += 1;
    expect(health.status().healthy).toBe(false);
    expect(health.status().reason).toContain('broker unreachable');
    health.brokerConnected();
    expect(health.status().healthy).toBe(true);
  });

  it('counts a broker that never connected from the start', () => {
    const { health, clock } = setup();
    clock.t += 3 * MIN;
    expect(health.status().healthy).toBe(false);
  });

  it('keeps the first loss time while the broker keeps failing to reconnect', () => {
    const { health, clock } = setup();
    health.brokerConnected();
    health.brokerLost();
    clock.t += MIN;
    health.brokerLost();
    clock.t += 90_000;
    expect(health.status().healthy).toBe(false);
  });

  it('Database down: unhealthy after more than five minutes of failing writes, healthy after the first success', () => {
    const { health, clock } = setup();
    health.brokerConnected();
    health.writeFailed();
    clock.t += 5 * MIN;
    expect(health.status().healthy).toBe(true);
    health.writeFailed();
    clock.t += 1 * MIN; // six minutes after the first failure
    const status = health.status();
    expect(status.healthy).toBe(false);
    expect(status.reason).toContain('database writes failing');
    health.writeOk();
    expect(health.status().healthy).toBe(true);
  });

  it('writes the status file atomically as JSON', async () => {
    const { health } = setup();
    const file = join(mkdtempSync(join(tmpdir(), 'sensors-h-')), 'sub', 'health.json');
    await writeStatusFile(file, health.status());
    expect(JSON.parse(readFileSync(file, 'utf8'))).toMatchObject({ healthy: true, reason: 'ok', updatedAt: expect.any(Number) });
  });
});

describe('healthcheck.mjs exit codes', () => {
  const script = new URL('../healthcheck.mjs', import.meta.url).pathname;
  const dir = mkdtempSync(join(tmpdir(), 'sensors-hc-'));

  function run(content: string | null, env: Record<string, string> = {}): number | null {
    const file = join(dir, `h-${Math.random().toString(36).slice(2)}.json`);
    if (content !== null) writeFileSync(file, content);
    return spawnSync(process.execPath, [script], { env: { ...process.env, SENSORS_HEALTH_FILE: file, ...env } }).status;
  }

  it('is healthy for a fresh file that says healthy', () => {
    expect(run(JSON.stringify({ healthy: true, updatedAt: Date.now() }))).toBe(0);
  });

  it('is unhealthy when the file says so', () => {
    expect(run(JSON.stringify({ healthy: false, reason: 'x', updatedAt: Date.now() }))).toBe(1);
  });

  it('is unhealthy when the file is stale, because the program stopped reporting', () => {
    expect(run(JSON.stringify({ healthy: true, updatedAt: Date.now() - 5 * MIN }))).toBe(1);
    expect(run(JSON.stringify({ healthy: true, updatedAt: Date.now() - 5000 }), { SENSORS_HEALTH_MAX_AGE_MS: '1000' })).toBe(1);
  });

  it('is unhealthy when the file is missing or garbage', () => {
    expect(run(null)).toBe(1);
    expect(run('not json')).toBe(1);
    expect(run('{}')).toBe(1);
  });
});
