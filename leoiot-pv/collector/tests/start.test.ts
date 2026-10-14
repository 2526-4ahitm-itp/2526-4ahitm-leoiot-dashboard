import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';
import { startCollector } from '../src/main.js';
import { json, sampleResult, startFake } from './helpers.js';

const fakes: Array<{ close: () => Promise<void> }> = [];
afterEach(async () => {
  await Promise.all(fakes.splice(0).map((f) => f.close()));
});

describe('Zusammenspiel mit lokalen Fakes', () => {
  it('holt von der Fake-Cloud, schreibt in die Fake-Datenbank und setzt die Health-Datei', async () => {
    const cloud = await startFake((req, res) =>
      req.url === '/openapi/auth/get_token'
        ? json(res, { code: 0, result: { access_token: 't' } })
        : json(res, { code: 10000, result: sampleResult() }),
    );
    const db = await startFake((_req, res) => {
      res.writeHead(204);
      res.end();
    });
    fakes.push(cloud, db);
    const dir = await mkdtemp(join(tmpdir(), 'collector-'));
    const healthFile = join(dir, 'last');
    const config = loadConfig({
      COLLECTOR_SOLAX_CLIENT_ID: 'test-client',
      COLLECTOR_SOLAX_CLIENT_SECRET: 'test-secret',
      COLLECTOR_SOLAX_USERNAME: 'test-user',
      COLLECTOR_SOLAX_PASSWORD: 'test-pass',
      COLLECTOR_SOLAX_PLANT_ID: 'test-plant',
      COLLECTOR_INFLUX_TOKEN: 'test-token',
      COLLECTOR_MQTT_USER: 'u',
      COLLECTOR_MQTT_PASSWORD: 'p',
      COLLECTOR_SOLAX_BASE_URL: cloud.url,
      COLLECTOR_INFLUX_URL: db.url,
      COLLECTOR_HEALTH_FILE: healthFile,
    });
    const collector = startCollector(config, () => {});
    await collector.stop();
    expect(db.requests).toHaveLength(1);
    expect(db.requests[0].url).toBe('/api/v2/write?org=leoiot&bucket=pv_shadow&precision=ns');
    expect(db.requests[0].body).toMatch(/^solax_stats,plant_id=test-plant daily_yield=20\.5,/);
    expect(Number(await readFile(healthFile, 'utf8'))).toBeGreaterThan(Date.now() - 10000);
  });
});
