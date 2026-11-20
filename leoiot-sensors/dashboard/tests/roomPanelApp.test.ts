// @vitest-environment happy-dom
// The room panel end to end (spec "The room is named in one line", "Temperature and humidity have their
// own lamps", "The day is summarised next to the values"): the page against recorded answers and a fake clock.
import { afterEach, describe, expect, it } from 'vitest';
import { makeFormat } from '../src/core/format';
import { BASE, disposeApps, latestCsv, startTestApp } from './harness';
import { fixture } from './helpers';

afterEach(disposeApps);
const digits = (s: string | null) => (s ?? '').replace(/\s/g, '');

describe('identity line', () => {
  it('room 105: "Raum 105", the link, no device name, no "gemessen", no pill', async () => {
    const t = await startTestApp();
    expect(document.querySelector('h1')!.textContent).toBe('Raum 105');
    expect(t.$('link3d').hidden).toBe(false);
    expect(t.$('link3d').getAttribute('href')).toBe('/3d/?room=105');
    expect(t.$('simTag').hidden).toBe(true);
    const panel = t.$('roomPanel').textContent!;
    expect(panel).not.toMatch(/gemessen|Sensorbox|nili3|Gerät/);
  });
  it('E10 is simulated: the pill says "simuliert"; in English "Room E10" and "simulated"', async () => {
    const t = await startTestApp({ search: '?room=E10', latest: fixture('latestE10.csv') });
    expect(document.querySelector('h1')!.textContent).toBe('Raum E10');
    expect(t.$('simTag').hidden).toBe(false);
    expect(t.$('simTag').textContent).toBe('simuliert');
    await t.click('[data-lang="en"]');
    expect(document.querySelector('h1')!.textContent).toBe('Room E10');
    expect(t.$('simTag').textContent).toBe('simulated');
  });
});

describe('small lamps', () => {
  it('room 105 (21.5 °C, 35 %): temperature green, humidity amber "zu trocken"; the CO₂ sentence is untouched', async () => {
    const t = await startTestApp({ latest: latestCsv(426) });
    expect(t.$('cellTemp').dataset.lamp).toBe('green');
    expect(t.$('dTemp').textContent).toBe('im Bereich');
    expect(t.$('cellHum').dataset.lamp).toBe('amber');
    expect(t.$('dHum').textContent).toBe('zu trocken');
    expect(t.$('status').textContent).toBe('Luft gut');
    expect(t.$('why').textContent).toBe('CO₂ liegt unter 800 ppm.');
    await t.click('[data-lang="en"]');
    expect(t.$('dHum').textContent).toBe('too dry');
  });
  it('a live message moves the small lamps, outdated readings switch them off, a new message brings them back', async () => {
    const t = await startTestApp();
    await t.connect();
    t.mqtt.message('leoiot/room-climate/105', { room: '105', device: 'nili3', source: 'sensor', ts: BASE + 1000, co2: 700, temperature: 17.2, humidity: 75 });
    expect([t.$('dTemp').textContent, t.$('dHum').textContent]).toEqual(['zu kalt', 'zu feucht']);
    await t.advance(302_000);
    expect(t.$('app').dataset.state).toBe('stale');
    expect([t.$('cellTemp').dataset.lamp, t.$('cellHum').dataset.lamp, t.$('app').dataset.air]).toEqual(['off', 'off', 'off']);
    expect(t.$('dTemp').textContent).toBe('');
    t.mqtt.message('leoiot/room-climate/105', { room: '105', device: 'nili3', source: 'sensor', ts: BASE + 303_000, co2: 700, temperature: 21, humidity: 50 });
    expect([t.$('cellTemp').dataset.lamp, t.$('cellHum').dataset.lamp]).toEqual(['green', 'green']);
  });
});

describe('Heute', () => {
  const count = (n: number) => `,result,table,_value\n,_result,0,${n}\n`;
  it('reads the 24 h series, the peak and the minutes above 1000 ppm, loaded together once a minute', async () => {
    const t = await startTestApp({ above: count(80) });
    expect(t.peakQueries()).toHaveLength(1);
    expect(t.aboveQueries()).toHaveLength(1);
    const q = t.peakQueries()[0];
    expect(q).toContain('r.room == "105" and r.source == "sensor"');
    expect(q).toContain('range(start: 2026-11-02T23:00:00Z, stop: 2026-11-03T06:36:30Z)'); // local midnight to now
    expect(t.aboveQueries()[0]).toContain('r.room == "105" and r.source == "sensor"');
    expect(t.aboveQueries()[0]).toContain('range(start: 2026-11-02T23:00:00Z, stop: 2026-11-03T06:36:30Z)');
    expect(digits(t.$('vPeak').textContent)).toBe('1450');
    expect(t.$('uPeak').textContent).toBe('ppm · 07:05');
    expect(t.$('todayTitle').textContent).toBe('Heute');
    expect(t.$('vAbove').textContent).toBe('1 h 20 min');
    expect(t.$('todayEmpty').hidden).toBe(true);
    await t.advance(60_000);
    expect(t.peakQueries().length).toBeGreaterThanOrEqual(2);
    expect(t.peakQueries()).toHaveLength(t.historyQueries().filter((h) => h.includes('every: 5m')).length); // always together
    expect(t.aboveQueries()).toHaveLength(t.peakQueries().length);
  });
  it('a short spike: one stored minute shows 1 min next to the peak', async () => {
    const t = await startTestApp({ above: count(1) });
    expect(t.$('vAbove').textContent).toBe('1 min');
    expect(digits(t.$('vPeak').textContent)).toBe('1450');
  });
  it('no minute stored but a peak above 1000 ppm: at least 1 min', async () => {
    const t = await startTestApp({ above: '' });
    expect(t.$('vAbove').textContent).toBe('1 min');
  });
  it('a peak of exactly 1000 ppm and no stored minute: not above 1000 ppm today', async () => {
    const t = await startTestApp({ above: '', peak: fixture('peak105.csv').replace(',1450', ',1000'), latest: latestCsv(900) });
    expect(t.$('vAbove').textContent).toBe('noch nicht');
  });
  it('the last good count and peak stay when their queries fail', async () => {
    const t = await startTestApp({ above: count(80) });
    t.state.peak = 'error,reference\nboom,1\n'; // an error table of InfluxDB
    t.state.above = 'error,reference\nboom,1\n';
    await t.advance(60_000);
    expect(t.aboveQueries().length).toBeGreaterThanOrEqual(2);
    expect(digits(t.$('vPeak').textContent)).toBe('1450');
    expect(t.$('vAbove').textContent).toBe('1 h 20 min');
  });
  it('a new count replaces the old one', async () => {
    const t = await startTestApp({ above: count(80) });
    t.state.above = count(85);
    await t.advance(60_000);
    expect(t.$('vAbove').textContent).toBe('1 h 25 min');
  });
  it('7-day range: the summary still covers today', async () => {
    const t = await startTestApp();
    const before = [t.$('vAbove').textContent, t.$('vPeak').textContent, t.$('vAired').textContent];
    await t.click('[data-range="7d"]');
    expect([t.$('vAbove').textContent, t.$('vPeak').textContent, t.$('vAired').textContent]).toEqual(before);
    expect(t.peakQueries().every((q) => q.includes('range(start: 2026-11-02T23:00:00Z'))).toBe(true);
  });
  it('English labels', async () => {
    const t = await startTestApp();
    await t.click('[data-lang="en"]');
    expect([t.$('todayTitle').textContent, t.$('kAbove').textContent, t.$('kPeak').textContent, t.$('kAired').textContent]).toEqual(['Today', 'Above 1000 ppm', 'Highest value', 'Last aired']);
    expect(t.$('uPeak').textContent).toBe('ppm · 07:05');
  });
  it('no peak row in the stored data: the current reading of today stands in', async () => {
    const t = await startTestApp({ peak: '' });
    expect(t.$('vPeak').textContent).toBe(makeFormat('de').number(1070, 0));
  });
  it('a room without readings: no history, no peak query, the panel is hidden', async () => {
    const t = await startTestApp({ search: '?room=X99', latest: fixture('latestX99.csv') });
    expect(t.peakQueries()).toHaveLength(0);
    expect(t.$('app').dataset.state).toBe('nodata');
  });
  it('an invalid room id is not queried', async () => {
    const t = await startTestApp({ search: '?room=105%22%20or%20true' });
    expect(t.queries).toHaveLength(0);
  });
});
