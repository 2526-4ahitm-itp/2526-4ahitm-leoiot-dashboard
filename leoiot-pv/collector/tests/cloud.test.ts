import { afterEach, describe, expect, it } from 'vitest';
import { createCloud } from '../src/adapters/cloud.js';
import { json, sampleResult, startFake } from './helpers.js';

const fakes: Array<{ close: () => Promise<void> }> = [];
afterEach(async () => {
  await Promise.all(fakes.splice(0).map((f) => f.close()));
});

function options(baseUrl: string) {
  return {
    baseUrl,
    clientId: 'test-client',
    clientSecret: 'test-secret',
    username: 'test-user',
    password: 'test-pass',
    plantId: 'test-plant',
  };
}

describe('SolaX-Cloud-Adapter', () => {
  it('meldet an und holt die Werte der Anlage', async () => {
    const fake = await startFake((req, res) => {
      if (req.url === '/openapi/auth/get_token') return json(res, { code: 0, result: { access_token: 'tok-1' } });
      json(res, { code: 10000, result: sampleResult() });
    });
    fakes.push(fake);
    const cloud = createCloud(options(fake.url));
    expect(await cloud.fetchRealtime()).toEqual(sampleResult());

    const [login, data] = fake.requests;
    expect(login.method).toBe('POST');
    expect(JSON.parse(login.body)).toEqual({
      client_id: 'test-client',
      client_secret: 'test-secret',
      grant_type: 'CICS',
      username: 'test-user',
      password: 'test-pass',
    });
    expect(data.url).toBe('/openapi/v2/plant/realtime_data?plantId=test-plant&businessType=4');
    expect(data.headers.authorization).toBe('Bearer tok-1');
  });

  it('behält die Sitzung für die nächste Abfrage', async () => {
    const fake = await startFake((req, res) => {
      if (req.url === '/openapi/auth/get_token') return json(res, { code: 0, result: { access_token: 'tok-1' } });
      json(res, { code: 10000, result: sampleResult() });
    });
    fakes.push(fake);
    const cloud = createCloud(options(fake.url));
    await cloud.fetchRealtime();
    await cloud.fetchRealtime();
    expect(fake.requests.filter((r) => r.url === '/openapi/auth/get_token')).toHaveLength(1);
  });

  for (const [name, reply] of [
    ['HTTP 401', (res: import('node:http').ServerResponse) => json(res, {}, 401)],
    ['HTTP 403', (res: import('node:http').ServerResponse) => json(res, {}, 403)],
    ['Cloud-Code 10401', (res: import('node:http').ServerResponse) => json(res, { code: 10401 })],
    ['unbekanntem Cloud-Code', (res: import('node:http').ServerResponse) => json(res, { code: 99999 })],
  ] as const) {
    it(`verwirft die Sitzung bei ${name} und meldet im nächsten Zyklus neu an`, async () => {
      let tokens = 0;
      let dataCalls = 0;
      const fake = await startFake((req, res) => {
        if (req.url === '/openapi/auth/get_token') {
          tokens += 1;
          return json(res, { code: 0, result: { access_token: `tok-${tokens}` } });
        }
        dataCalls += 1;
        if (dataCalls === 1) return reply(res);
        json(res, { code: 10000, result: sampleResult() });
      });
      fakes.push(fake);
      const cloud = createCloud(options(fake.url));
      await expect(cloud.fetchRealtime()).rejects.toThrow();
      expect(cloud.hasSession()).toBe(false);
      expect(await cloud.fetchRealtime()).toEqual(sampleResult());
      expect(tokens).toBe(2);
      expect(fake.requests.at(-1)?.headers.authorization).toBe('Bearer tok-2');
    });
  }

  it('versucht nach fehlgeschlagener Anmeldung erst im nächsten Zyklus erneut', async () => {
    let logins = 0;
    const fake = await startFake((req, res) => {
      if (req.url === '/openapi/auth/get_token') {
        logins += 1;
        return logins === 1 ? json(res, { code: 10001, message: 'nein' }) : json(res, { code: 0, result: { access_token: 't' } });
      }
      json(res, { code: 10000, result: sampleResult() });
    });
    fakes.push(fake);
    const cloud = createCloud(options(fake.url));
    await expect(cloud.fetchRealtime()).rejects.toThrow(/Anmeldung/);
    expect(logins).toBe(1); // kein sofortiger zweiter Versuch
    expect(fake.requests).toHaveLength(1);
    expect(await cloud.fetchRealtime()).toEqual(sampleResult());
    expect(logins).toBe(2);
  });

  it('wirft bei nicht erreichbarem Server', async () => {
    const fake = await startFake((_req, res) => json(res, {}));
    const url = fake.url;
    await fake.close();
    const cloud = createCloud(options(url));
    await expect(cloud.fetchRealtime()).rejects.toThrow();
    expect(cloud.hasSession()).toBe(false);
  });

  it('behält die Sitzung bei einem Serverfehler 500', async () => {
    let dataCalls = 0;
    const fake = await startFake((req, res) => {
      if (req.url === '/openapi/auth/get_token') return json(res, { code: 0, result: { access_token: 't' } });
      dataCalls += 1;
      if (dataCalls === 1) return json(res, {}, 500);
      json(res, { code: 10000, result: sampleResult() });
    });
    fakes.push(fake);
    const cloud = createCloud(options(fake.url));
    await expect(cloud.fetchRealtime()).rejects.toThrow(/500/);
    expect(cloud.hasSession()).toBe(true);
  });
});
