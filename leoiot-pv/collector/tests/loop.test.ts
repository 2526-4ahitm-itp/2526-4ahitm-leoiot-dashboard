import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createLoop } from '../src/loop.js';
import { collectLog, sampleResult } from './helpers.js';

const START = Date.UTC(2026, 9, 14, 10, 0, 0);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(START);
});
afterEach(() => {
  vi.useRealTimers();
});

function setup(options: { publish?: boolean } = {}) {
  const state = { cloudFails: false, influxFails: false };
  const writes: string[] = [];
  const published: Array<{ topic: string; payload: string }> = [];
  const delivered: number[] = [];
  const { lines, log } = collectLog();
  const loop = createLoop({
    plantId: 'test-plant',
    intervalMs: 60000,
    publish: options.publish ?? false,
    cloud: {
      async fetchRealtime() {
        if (state.cloudFails) throw new Error('Cloud nicht erreichbar');
        return sampleResult();
      },
    },
    influx: {
      async write(line) {
        if (state.influxFails) throw new Error('Datenbank lehnt ab');
        writes.push(line);
      },
    },
    broker: {
      publish(topic, payload) {
        published.push({ topic, payload });
        return true;
      },
    },
    markDelivered: (ms) => {
      delivered.push(ms);
    },
    log,
  });
  return { loop, state, writes, published, delivered, lines };
}

describe('Schleife', () => {
  it('liefert beim Start sofort und danach einmal pro Minute', async () => {
    const t = setup();
    t.loop.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(t.writes).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(10 * 60000);
    expect(t.writes).toHaveLength(11);
    expect(t.delivered).toHaveLength(11);
    expect(t.delivered[0]).toBe(START);
    expect(t.delivered[1]).toBe(START + 60000);
    await t.loop.stop();
  });

  it('liefert nach einer Stunde Cloud-Ausfall in der ersten Minute danach', async () => {
    const t = setup();
    t.state.cloudFails = true;
    t.loop.start();
    await vi.advanceTimersByTimeAsync(60 * 60000);
    expect(t.writes).toHaveLength(0);
    expect(t.lines.filter((l) => l.includes('Zyklus übersprungen')).length).toBeGreaterThanOrEqual(60);
    t.state.cloudFails = false;
    await vi.advanceTimersByTimeAsync(60000);
    expect(t.writes).toHaveLength(1);
    expect(t.delivered).toHaveLength(1);
    await t.loop.stop();
  });

  it('veröffentlicht nichts, wenn Veröffentlichen aus ist', async () => {
    const t = setup({ publish: false });
    t.loop.start();
    await vi.advanceTimersByTimeAsync(3 * 60000);
    expect(t.writes.length).toBeGreaterThan(0);
    expect(t.published).toHaveLength(0);
    await t.loop.stop();
  });

  it('veröffentlicht die komplette Antwort, wenn Veröffentlichen an ist', async () => {
    const t = setup({ publish: true });
    t.loop.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(t.published).toEqual([
      { topic: 'leoenergy/solax_pv/overall_inverter', payload: JSON.stringify(sampleResult()) },
    ]);
    await t.loop.stop();
  });

  it('schreibt die erwartete Zeile mit dem Zeitpunkt der Abfrage', async () => {
    const t = setup();
    t.loop.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(t.writes[0]).toBe(
      `solax_stats,plant_id=test-plant daily_yield=20.5,total_yield=12345.5,consumption=18.25,` +
        `daily_charged=4.5,daily_discharged=2.5,daily_imported=3,daily_exported=5.25 ${START * 1000000}`,
    );
    await t.loop.stop();
  });

  it('speichert und veröffentlicht nichts bei unvollständiger Lesung und nennt den Wert', async () => {
    const lines: string[] = [];
    const writes: string[] = [];
    const published: string[] = [];
    let incomplete = true;
    const loop = createLoop({
      plantId: 'p',
      intervalMs: 60000,
      publish: true,
      cloud: {
        async fetchRealtime() {
          const r = sampleResult();
          if (incomplete) delete r.dailyExported;
          return r;
        },
      },
      influx: { write: async (l) => void writes.push(l) },
      broker: { publish: (_t, p) => (published.push(p), true) },
      markDelivered: () => {},
      log: (m) => lines.push(m),
    });
    loop.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(writes).toHaveLength(0);
    expect(published).toHaveLength(0);
    expect(lines.join('\n')).toContain('dailyExported');
    incomplete = false;
    await vi.advanceTimersByTimeAsync(60000);
    expect(writes).toHaveLength(1);
    await loop.stop();
  });

  it('loggt eine abgelehnte Schreibung, schreibt in der nächsten Minute weiter und markiert nicht', async () => {
    const t = setup({ publish: true });
    t.state.influxFails = true;
    t.loop.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(t.delivered).toHaveLength(0);
    expect(t.lines.join('\n')).toContain('Schreiben in InfluxDB fehlgeschlagen');
    expect(t.published).toHaveLength(1); // Speichern und Veröffentlichen sind unabhängig
    t.state.influxFails = false;
    await vi.advanceTimersByTimeAsync(60000);
    expect(t.writes).toHaveLength(1);
    expect(t.delivered).toHaveLength(1);
    await t.loop.stop();
  });

  it('loggt einen Zählerrückgang und liefert den Wert unverändert', async () => {
    const lines: string[] = [];
    const writes: string[] = [];
    const values = [12.3, 11.9];
    const loop = createLoop({
      plantId: 'p',
      intervalMs: 60000,
      publish: false,
      cloud: { fetchRealtime: async () => sampleResult({ dailyImported: values.shift() ?? 11.9 }) },
      influx: { write: async (l) => void writes.push(l) },
      broker: { publish: () => true },
      markDelivered: () => {},
      log: (m) => lines.push(m),
    });
    loop.start();
    await vi.advanceTimersByTimeAsync(60000);
    expect(writes[1]).toContain('daily_imported=11.9');
    const hit = lines.find((l) => l.includes('Zähler zurückgegangen'));
    expect(hit).toContain('daily_imported');
    expect(hit).toContain('12.3');
    expect(hit).toContain('11.9');
    await loop.stop();
  });

  it('bleibt am Leben, wenn der Broker eine Ausnahme wirft', async () => {
    const writes: string[] = [];
    const loop = createLoop({
      plantId: 'p',
      intervalMs: 60000,
      publish: true,
      cloud: { fetchRealtime: async () => sampleResult() },
      influx: { write: async (l) => void writes.push(l) },
      broker: {
        publish: () => {
          throw new Error('Broker kaputt');
        },
      },
      markDelivered: () => {},
      log: () => {},
    });
    loop.start();
    await vi.advanceTimersByTimeAsync(2 * 60000);
    expect(writes).toHaveLength(3);
    await loop.stop();
  });

  it('hält nach stop() den Takt an', async () => {
    const t = setup();
    t.loop.start();
    await vi.advanceTimersByTimeAsync(0);
    await t.loop.stop();
    await vi.advanceTimersByTimeAsync(5 * 60000);
    expect(t.writes).toHaveLength(1);
  });
});
