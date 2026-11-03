// @vitest-environment happy-dom
// Task 4.2 and 4.3 end to end: the page (startApp) against recorded query answers, a fake broker and a
// fake clock. Specs "Two time ranges", "Gap in the readings", "Above the limit for a while",
// "Live values have a fallback", "New reading arrives", "Box sends again", "Unknown room in the address".
import { afterEach, describe, expect, it } from 'vitest';
import { parseAnnotatedCsv } from '../src/core/csv';
import { rangeBounds } from '../src/core/ranges';
import { parseHistory } from '../src/core/snapshot';
import { loadHistory } from '../src/data/load';
import { BASE, disposeApps, fakeEcharts, latestCsv, startTestApp } from './harness';
import { fixture } from './helpers';

afterEach(disposeApps);
const TOPIC = 'leoiot/room-climate/105';
const reading = (ts: number, extra: Record<string, unknown> = {}) => ({ room: '105', device: 'nili3', source: 'sensor', ts, ...extra });

describe('Two time ranges (recorded answers)', () => {
  const nowOfRecording = Date.parse('2026-11-03T06:36:39Z');
  it('24 hours: five-minute windows, ending now', () => {
    const pts = parseHistory(parseAnnotatedCsv(fixture('history24h.csv')));
    // the last window ends at "now" instead of on the grid
    const steps = new Set(pts.slice(0, -2).map((p, i) => pts[i + 1].t - p.t));
    expect([...steps]).toEqual([5 * 60_000]);
    expect(pts.at(-1)!.t).toBe(rangeBounds('24h', nowOfRecording).end);
  });
  it('7 days: thirty-minute windows, ending now', () => {
    const pts = parseHistory(parseAnnotatedCsv(fixture('history7d.csv')));
    const steps = new Set(pts.slice(0, -2).map((p, i) => pts[i + 1].t - p.t));
    expect([...steps]).toEqual([30 * 60_000]);
    expect(pts.at(-1)!.t).toBe(rangeBounds('7d', nowOfRecording).end);
    expect(pts.every((p) => p.t > rangeBounds('7d', nowOfRecording).start)).toBe(true);
  });
  it('the 7-day query asks for seven days back from now and thirty-minute windows, the answer is parsed', async () => {
    const asked: string[] = [];
    const pts = await loadHistory(async (q) => (asked.push(q), fixture('history7d.csv')), '105', 'sensor', '7d', nowOfRecording);
    expect(asked[0]).toContain('range(start: 2026-10-27T06:36:39Z, stop: 2026-11-03T06:36:39Z)');
    expect(asked[0]).toContain('every: 30m');
    expect(pts).toHaveLength(24);
  });
  it('gap in the readings: the 7-day answer has a gap between the readings, kept as unknown', () => {
    const pts = parseHistory(parseAnnotatedCsv(fixture('history7d.csv')));
    const gap = pts.find((p) => p.t === Date.parse('2026-11-03T02:30:00Z'))!;
    expect(gap).toMatchObject({ co2: null, temperature: null, humidity: null });
    expect(pts.some((p) => p.co2 === 0 || p.temperature === 0 || p.humidity === 0)).toBe(false);
  });
});

describe('the page loads and uses the stored readings', () => {
  it('start: one latest query and one 24 h history query for the shown room and the source of the newest reading', async () => {
    const t = await startTestApp({ latest: fixture('latestE10.csv'), search: '?room=E10' });
    expect(t.latestQueries()).toBe(1);
    expect(t.historyQueries()).toHaveLength(1);
    expect(t.historyQueries()[0]).toContain('r.source == "simulated"');
    expect(t.historyQueries()[0]).toContain('every: 5m');
  });
  it('switching to 7 days loads the thirty-minute series once and keeps it', async () => {
    const t = await startTestApp({ history: fixture('history24h.csv') });
    await t.click('[data-range="7d"]');
    expect(t.historyQueries().filter((q) => q.includes('every: 30m'))).toHaveLength(1);
    await t.click('[data-range="24h"]');
    await t.click('[data-range="7d"]');
    expect(t.historyQueries().filter((q) => q.includes('every: 30m'))).toHaveLength(1);
  });
  it('charts get the points of the shown range, with gaps as unknown, and dashed lines only for simulated readings', async () => {
    const measured = fakeEcharts();
    await startTestApp({ echarts: measured.api });
    expect(measured.connected).toHaveLength(1);
    const airOpt = measured.charts[1].options.at(-1) as any;
    expect(airOpt.series[0].lineStyle.type).toBe('solid');
    expect(airOpt.series[0].data.some(([, v]: [number, number | null]) => v === null)).toBe(true);
    expect(airOpt.series[0].connectNulls).toBe(false);
    disposeApps();

    const simulated = fakeEcharts();
    await startTestApp({ search: '?room=E10', latest: fixture('latestE10.csv'), echarts: simulated.api });
    const simOpt = simulated.charts[1].options.at(-1) as any;
    expect(simOpt.series.map((s: any) => s.lineStyle.type)).toEqual(['dashed', 'dashed']);
    expect((simulated.charts[0].options.at(-1) as any).series[0].lineStyle.type).toBe('dashed');
  });
  it('a room without readings shows no charts and loads no history', async () => {
    const e = fakeEcharts();
    const t = await startTestApp({ search: '?room=X99', latest: fixture('latestX99.csv'), echarts: e.api });
    expect(t.$('app').dataset.state).toBe('nodata');
    expect(t.$('emptyTitle').textContent).toBe('Keine Daten für Raum X99');
    expect(t.$('status').textContent).toBe('');
    expect(t.historyQueries()).toHaveLength(0);
    // the charts may be set up while loading, but never receive a reading
    for (const c of e.charts) for (const o of c.options) expect((o as any).series.every((s: any) => s.data.length === 0)).toBe(true);
  });
  it('an invalid room id is never queried', async () => {
    const t = await startTestApp({ search: '?room=105%22%20or%20true' });
    expect(t.queries).toHaveLength(0);
    expect(t.$('app').dataset.state).toBe('nodata');
  });
  it('stored readings that cannot be reached: an error message instead of "no data", tried again every minute', async () => {
    const t = await startTestApp({ failing: true });
    expect(t.$('app').dataset.state).toBe('error');
    expect(t.$('emptyTitle').textContent).toBe('Daten nicht erreichbar');
    t.state.fail = false;
    await t.advance(60_000);
    expect(t.$('app').dataset.state).toBe('live');
  });
});

describe('Above the limit for a while (history read by the page)', () => {
  it('yellow since the start of the run in the five-minute series', async () => {
    const t = await startTestApp({ latest: latestCsv(868) });
    expect(t.$('app').dataset.air).toBe('soon');
    expect(t.$('status').textContent).toBe('Bald lüften');
    expect(t.$('why').textContent).toBe('CO₂ liegt seit 04:05 über 800 ppm.'); // 03:05 UTC, first window above 800
  });
  it('red since the start of the run above 1000 ppm', async () => {
    const t = await startTestApp();
    expect(t.$('app').dataset.air).toBe('bad');
    expect(t.$('status').textContent).toBe('Jetzt lüften');
    expect(t.$('why').textContent).toBe('CO₂ liegt seit 07:05 über 1000 ppm. Fenster weit öffnen.');
  });
});

describe('New reading arrives', () => {
  it('a live message updates values and time at once, in the same elements, and the age counts up', async () => {
    const t = await startTestApp();
    await t.connect();
    const cells = ['vCo2', 'vTemp', 'vHum'].map(t.$);
    expect(cells.map((c) => c.textContent!.replace(/\s/g, ''))).toEqual(['1070', '21,5', '35']);
    t.mqtt.message(TOPIC, reading(BASE + 3000, { co2: 640, temperature: 22.04, humidity: 37 }));
    expect(cells.map((c) => c.textContent)).toEqual(['640', '22,0', '37']);
    expect(['vCo2', 'vTemp', 'vHum'].map(t.$)).toEqual(cells);
    expect(t.$('app').dataset.air).toBe('good');
    expect(t.$('status').textContent).toBe('Luft gut');
    expect(t.$('fresh').textContent).toBe('Stand 07:36:33 · vor 0 s');
    await t.advance(8000);
    expect(t.$('fresh').textContent).toBe('Stand 07:36:33 · vor 5 s');
  });
  it('a message with fewer values keeps the others; a message for another room is ignored', async () => {
    const t = await startTestApp();
    await t.connect();
    t.mqtt.message(TOPIC, reading(BASE + 1000, { co2: 700 }));
    expect(t.$('vCo2').textContent).toBe('700');
    expect(t.$('vTemp').textContent).toBe('21,5');
    t.mqtt.message(TOPIC, { ...reading(BASE + 2000, { co2: 2000 }), room: '106' });
    expect(t.$('vCo2').textContent).toBe('700');
  });
  it('the age counts up while nothing arrives, then the values are outdated; a new message brings them back', async () => {
    const t = await startTestApp();
    await t.connect();
    t.mqtt.message(TOPIC, reading(BASE, { co2: 868, temperature: 21.4, humidity: 40 }));
    await t.advance(300_000);
    expect(t.$('app').dataset.state).toBe('live');
    await t.advance(2000);
    expect(t.$('app').dataset).toMatchObject({ state: 'stale', air: 'off', fresh: 'stale' });
    expect(t.$('status').textContent).toBe('Keine aktuellen Werte');
    expect(t.$('why').textContent).toBe('Letzter Messwert um 07:36, vor 5 Minuten. Die Werte unten sind nicht aktuell.');
    expect(t.$('vCo2').textContent).toBe('868');
    t.mqtt.message(TOPIC, reading(BASE + 302_000, { co2: 640 }));
    expect(t.$('app').dataset).toMatchObject({ state: 'live', air: 'good', fresh: 'live' });
    expect(t.$('status').textContent).toBe('Luft gut');
  });
  it('a first message for a room that had no data shows the panel without a reload', async () => {
    const t = await startTestApp({ latest: fixture('latestX99.csv') });
    await t.connect();
    expect(t.$('app').dataset.state).toBe('nodata');
    t.mqtt.message(TOPIC, reading(BASE + 1000, { co2: 650, temperature: 21, humidity: 40 }));
    expect(t.$('app').dataset).toMatchObject({ state: 'live', air: 'good' });
  });
});

describe('Live values have a fallback', () => {
  it('live channel down: the stored readings are fetched once a minute, live again after it is back', async () => {
    const t = await startTestApp();
    await t.connect();
    expect(t.latestQueries()).toBe(1);
    expect(t.$('fresh').textContent).not.toContain('jede Minute');

    t.mqtt.emit('close'); // /mqtt does not answer
    await t.advance(0);
    expect(t.latestQueries()).toBe(2); // fetched at once
    expect(t.$('fresh').textContent).toMatch(/ · Aktualisierung jede Minute$/);

    t.state.latest = latestCsv(930, '2026-11-03T06:37:20Z');
    await t.advance(60_000);
    expect(t.latestQueries()).toBe(3);
    expect(t.$('vCo2').textContent).toBe('930');
    expect(t.$('fresh').textContent).toMatch(/^Stand 07:37:20 · /);
    await t.advance(60_000);
    expect(t.latestQueries()).toBe(4);

    await t.connect(); // /mqtt is back
    expect(t.$('fresh').textContent).not.toContain('jede Minute');
    await t.advance(180_000);
    expect(t.latestQueries()).toBe(4); // no more polling
    t.mqtt.message(TOPIC, reading(BASE + 400_000, { co2: 610 }));
    expect(t.$('vCo2').textContent).toBe('610');
  });
  it('the connection never completes: the fallback starts after the grace time', async () => {
    const t = await startTestApp();
    await t.advance(9000);
    expect(t.$('fresh').textContent).toContain('Aktualisierung jede Minute');
    expect(t.latestQueries()).toBe(2);
  });
});
