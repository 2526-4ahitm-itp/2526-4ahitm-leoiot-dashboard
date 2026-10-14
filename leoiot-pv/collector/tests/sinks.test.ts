import { afterEach, describe, expect, it } from 'vitest';
import { createBroker, type MqttLike } from '../src/adapters/broker.js';
import { createInflux } from '../src/adapters/influx.js';
import { collectLog, json, startFake } from './helpers.js';

const fakes: Array<{ close: () => Promise<void> }> = [];
afterEach(async () => {
  await Promise.all(fakes.splice(0).map((f) => f.close()));
});

describe('Datenbank-Adapter', () => {
  it('sendet genau die Zeile mit Org, Bucket, Precision und Token', async () => {
    const fake = await startFake((_req, res) => {
      res.writeHead(204);
      res.end();
    });
    fakes.push(fake);
    const influx = createInflux({ url: fake.url, org: 'leoiot', bucket: 'pv_shadow', token: 'test-token' });
    await influx.write('solax_stats,plant_id=test-plant daily_yield=1 1000000');
    const [req] = fake.requests;
    expect(req.method).toBe('POST');
    expect(req.url).toBe('/api/v2/write?org=leoiot&bucket=pv_shadow&precision=ns');
    expect(req.headers.authorization).toBe('Token test-token');
    expect(req.headers['content-type']).toBe('text/plain; charset=utf-8');
    expect(req.body).toBe('solax_stats,plant_id=test-plant daily_yield=1 1000000');
  });

  it('wirft bei abgelehntem Schreiben', async () => {
    const fake = await startFake((_req, res) => json(res, { message: 'unauthorized' }, 401));
    fakes.push(fake);
    const influx = createInflux({ url: fake.url, org: 'o', bucket: 'b', token: 't' });
    await expect(influx.write('x')).rejects.toThrow(/401/);
  });
});

function fakeMqtt(connected: boolean) {
  const published: Array<{ topic: string; payload: string; options: { qos: number; retain: boolean } }> = [];
  const listeners: Record<string, Array<(...a: any[]) => void>> = {};
  const client: MqttLike & { published: typeof published; emit: (e: string, ...a: any[]) => void } = {
    connected,
    published,
    on(event, listener) {
      (listeners[event] ??= []).push(listener);
      return client;
    },
    publish(topic, payload, options, cb) {
      published.push({ topic, payload, options });
      cb?.(null);
      return client;
    },
    end(_force, cb) {
      cb?.();
      return client;
    },
    emit(event, ...args) {
      (listeners[event] ?? []).forEach((l) => l(...args));
    },
  };
  return client;
}

describe('Broker-Adapter', () => {
  it('veröffentlicht Thema, Nutzlast, retained und QoS 0', () => {
    const client = fakeMqtt(true);
    let seen: unknown;
    const broker = createBroker({
      url: 'mqtt://fake:1883',
      username: 'u',
      password: 'p',
      log: () => {},
      connect: (url, o) => {
        seen = { url, ...o };
        return client;
      },
    });
    expect(broker.publish('leoenergy/solax_pv/overall_inverter', '{"a":1}')).toBe(true);
    expect(client.published).toEqual([
      { topic: 'leoenergy/solax_pv/overall_inverter', payload: '{"a":1}', options: { qos: 0, retain: true } },
    ]);
    expect(seen).toEqual({ url: 'mqtt://fake:1883', username: 'u', password: 'p', reconnectPeriod: 5000 });
  });

  it('wirft nicht, wenn der Broker nicht erreichbar ist', () => {
    const client = fakeMqtt(false);
    const { lines, log } = collectLog();
    const broker = createBroker({ url: 'x', username: 'u', password: 'p', log, connect: () => client });
    expect(broker.publish('t', 'p')).toBe(false);
    expect(client.published).toHaveLength(0);
    expect(lines.join('\n')).toContain('Broker nicht erreichbar');
  });

  it('wirft nicht, wenn der Client beim Veröffentlichen eine Ausnahme wirft', () => {
    const client = fakeMqtt(true);
    client.publish = () => {
      throw new Error('kaputt');
    };
    const broker = createBroker({ url: 'x', username: 'u', password: 'p', log: () => {}, connect: () => client });
    expect(broker.publish('t', 'p')).toBe(false);
  });

  it('veröffentlicht wieder, sobald die Verbindung zurück ist', () => {
    const client = fakeMqtt(false);
    const broker = createBroker({ url: 'x', username: 'u', password: 'p', log: () => {}, connect: () => client });
    expect(broker.publish('t', 'p1')).toBe(false);
    client.connected = true;
    expect(broker.publish('t', 'p2')).toBe(true);
    expect(client.published.map((m) => m.payload)).toEqual(['p2']);
  });

  it('loggt Client-Fehler, ohne zu werfen', () => {
    const client = fakeMqtt(false);
    const { lines, log } = collectLog();
    createBroker({ url: 'x', username: 'u', password: 'p', log, connect: () => client }).start();
    client.emit('error', new Error('refused'));
    expect(lines.join('\n')).toContain('refused');
  });
});
