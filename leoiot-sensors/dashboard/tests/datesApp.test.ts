// @vitest-environment happy-dom
// The date segment, its panel and the selection in the page (task groups 2.1 to 2.3).
/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterEach, describe, expect, it } from 'vitest';
import { errorText, panelPosition, prefillDates } from '../src/ui/datesPanel';
import { disposeApps, fakeEcharts, startTestApp } from './harness';
import { flush } from './helpers';

afterEach(disposeApps);
// Test "now": Tue 3 Nov 2026, 07:36:30 Vienna. Allowed days: 2025-10-03 to 2026-11-03.

type T = Awaited<ReturnType<typeof startTestApp>>;
const field = (t: T, id: 'datesFrom' | 'datesTo') => t.$(id) as HTMLInputElement;
async function submit(t: T, from: string, to: string) {
  field(t, 'datesFrom').value = from;
  field(t, 'datesTo').value = to;
  t.$('datesForm').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  await flush();
}
async function pick(t: T, from: string, to: string) {
  await t.click('#datesBtn');
  await submit(t, from, to);
}
const escape = () => document.getElementById('datesPanel')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

describe('panel helpers', () => {
  const now = Date.parse('2026-11-03T06:36:30Z');
  it('prefill: the shown dates, else a week back to today', () => {
    expect(prefillDates({ kind: '24h' }, now)).toEqual({ from: '2026-10-27', to: '2026-11-03' });
    expect(prefillDates({ kind: 'dates', from: '2026-10-01', to: '2026-10-02' }, now)).toEqual({ from: '2026-10-01', to: '2026-10-02' });
  });
  it('error texts in both languages', () => {
    expect(errorText('ok', 'de', now)).toBe('');
    expect(errorText('order', 'de', now)).toBe('Der erste Tag darf nicht nach dem letzten liegen.');
    expect(errorText('order', 'en', now)).toBe('The first day must not be after the last day.');
    expect(errorText('span', 'de', now)).toBe('Bitte zwei Tage zwischen 3.10.2025 und 3.11.2026 wählen.');
    expect(errorText('invalid', 'en', now)).toBe('Please choose two days between 3 Oct 2025 and 3 Nov 2026.');
  });
  it('position: below the button, clamped, full width on a phone', () => {
    expect(panelPosition({ left: 300, bottom: 50 }, 340, 1280)).toEqual({ top: 56, left: 300, right: null });
    expect(panelPosition({ left: 1200, bottom: 50 }, 340, 1280)).toEqual({ top: 56, left: 924, right: null });
    expect(panelPosition({ left: 2, bottom: 50 }, 340, 1280).left).toBe(16);
    expect(panelPosition({ left: 100, bottom: 90 }, 340, 375)).toEqual({ top: 96, left: 16, right: 16 });
  });
});

describe('the date segment', () => {
  it('not selected: text, attributes, panel closed', async () => {
    const t = await startTestApp();
    const b = t.$('datesBtn');
    expect(t.$('datesText').textContent).toBe('Zeitraum wählen');
    expect([b.getAttribute('aria-pressed'), b.getAttribute('aria-expanded'), b.getAttribute('aria-controls')]).toEqual(['false', 'false', 'datesPanel']);
    expect(b.hasAttribute('aria-label')).toBe(false);
    expect(t.$('datesPanel').hidden).toBe(true);
    expect(t.$('datesPanel').getAttribute('aria-label')).toBe('Zeitraum wählen');
    await t.click('[data-lang="en"]');
    expect(t.$('datesText').textContent).toBe('Pick dates');
    expect(t.$('datesFromLabel').textContent).toBe('From');
    expect(t.$('datesSubmit').textContent).toBe('Show');
  });
  it('selected: pressed, shows the dates, accessible name with the full range; 24 h and 7 Tage released', async () => {
    const t = await startTestApp();
    await pick(t, '2026-10-12', '2026-10-16');
    const b = t.$('datesBtn');
    expect(t.$('datesText').textContent).toBe('12.10. – 16.10.');
    expect([b.getAttribute('aria-pressed'), b.getAttribute('aria-expanded')]).toEqual(['true', 'false']);
    expect(b.getAttribute('aria-label')).toBe('Zeitraum: 12.10.2026 – 16.10.2026');
    expect(['24h', '7d'].map((r) => t.$('rangeGroup').querySelector(`[data-range="${r}"]`)!.getAttribute('aria-pressed'))).toEqual(['false', 'false']);
    await t.click('[data-lang="en"]');
    expect(t.$('datesText').textContent).toBe('12 Oct – 16 Oct');
    expect(b.getAttribute('aria-label')).toBe('Dates: 12 Oct 2026 – 16 Oct 2026');
  });
  it('one day and another year', async () => {
    const t = await startTestApp();
    await pick(t, '2026-10-13', '2026-10-13');
    expect(t.$('datesText').textContent).toBe('Di 13.10.');
    await pick(t, '2025-11-17', '2025-11-20');
    expect(t.$('datesText').textContent).toBe('17.11.2025 – 20.11.2025');
  });
});

describe('the date panel', () => {
  it('opens with the prefill, min and max, focus on Von', async () => {
    const t = await startTestApp();
    await t.click('#datesBtn');
    expect(t.$('datesPanel').hidden).toBe(false);
    expect(t.$('datesBtn').getAttribute('aria-expanded')).toBe('true');
    expect([field(t, 'datesFrom').value, field(t, 'datesTo').value]).toEqual(['2026-10-27', '2026-11-03']);
    for (const id of ['datesFrom', 'datesTo'] as const) expect([field(t, id).min, field(t, id).max]).toEqual(['2025-10-03', '2026-11-03']);
    expect(document.activeElement).toBe(field(t, 'datesFrom'));
    expect(t.$('datesFromLabel').textContent).toBe('Von');
    expect(t.$('datesError').hidden).toBe(true);
  });
  it('prefills with the shown dates when reopened', async () => {
    const t = await startTestApp();
    await pick(t, '2026-10-12', '2026-10-16');
    await t.click('#datesBtn');
    expect([field(t, 'datesFrom').value, field(t, 'datesTo').value]).toEqual(['2026-10-12', '2026-10-16']);
  });
  it('first after last: message with the triangle, panel stays, nothing changes', async () => {
    const t = await startTestApp();
    const before = t.historyQueries().length;
    await pick(t, '2026-10-20', '2026-10-17');
    expect(t.$('datesError').hidden).toBe(false);
    expect(t.$('datesErrorText').textContent).toBe('Der erste Tag darf nicht nach dem letzten liegen.');
    expect(t.$('datesError').querySelector('svg')).not.toBeNull();
    expect(t.$('datesPanel').hidden).toBe(false);
    expect(t.$('datesBtn').getAttribute('aria-pressed')).toBe('false');
    expect(t.historyQueries().length).toBe(before);
  });
  it('days outside the span get the span message', async () => {
    const t = await startTestApp();
    await pick(t, '2025-10-02', '2026-10-17');
    expect(t.$('datesErrorText').textContent).toBe('Bitte zwei Tage zwischen 3.10.2025 und 3.11.2026 wählen.');
  });
  it('apply closes the panel and returns focus to the segment', async () => {
    const t = await startTestApp();
    await pick(t, '2026-10-12', '2026-10-16');
    expect(t.$('datesPanel').hidden).toBe(true);
    expect(t.$('datesBtn').getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(t.$('datesBtn'));
  });
  it('Escape closes without change and returns focus', async () => {
    const t = await startTestApp();
    await t.click('#datesBtn');
    escape();
    expect(t.$('datesPanel').hidden).toBe(true);
    expect(t.$('datesBtn').getAttribute('aria-expanded')).toBe('false');
    expect(t.$('datesBtn').getAttribute('aria-pressed')).toBe('false');
    expect(document.activeElement).toBe(t.$('datesBtn'));
  });
  it('a click outside closes it; a second click on the segment closes it too', async () => {
    const t = await startTestApp();
    await t.click('#datesBtn');
    document.getElementById('status')!.click();
    expect(t.$('datesPanel').hidden).toBe(true);
    await t.click('#datesBtn');
    await t.click('#datesBtn');
    expect(t.$('datesPanel').hidden).toBe(true);
  });
});

describe('the selection in the page', () => {
  it('chosen dates load that range once with the matching window; the fixed range is not refreshed by live messages', async () => {
    const t = await startTestApp({ echarts: fakeEcharts().api });
    await pick(t, '2026-10-12', '2026-10-16');
    const q = t.historyQueries().at(-1)!;
    expect(q).toContain('range(start: 2026-10-11T22:00:00Z, stop: 2026-10-16T22:00:00Z)');
    expect(q).toContain('every: 30m');
    expect(t.$('winCo2').textContent).toBe('12.10. – 16.10.2026 · ppm');
    const fixed = () => t.historyQueries().filter((x) => x.includes('2026-10-11T22:00:00Z')).length;
    expect(fixed()).toBe(1);
    await t.connect();
    t.mqtt.message('leoiot/room-climate/105', { room: '105', device: 'nili3', source: 'sensor', ts: Math.floor((Date.parse('2026-11-03T06:36:30Z') + t.timers.now) / 1000), co2: 900 });
    await t.advance(60_000);
    await t.advance(60_000);
    expect(fixed()).toBe(1);
    // the 24-hour series keeps refreshing
    expect(t.historyQueries().filter((x) => x.includes('every: 5m')).length).toBeGreaterThan(1);
  });
  it('a range ending today keeps refreshing', async () => {
    const t = await startTestApp({ echarts: fakeEcharts().api });
    await pick(t, '2026-11-01', '2026-11-03');
    const live = () => t.historyQueries().filter((x) => x.includes('range(start: 2026-10-31T23:00:00Z')).length;
    expect(live()).toBe(1);
    expect(t.$('winCo2').textContent).toBe('1.11., 00:00 – 3.11., 07:36 · ppm');
    await t.advance(60_000);
    expect(live()).toBeGreaterThan(1);
  });
  it('24 h clears the dates and 7 Tage too', async () => {
    const t = await startTestApp();
    await pick(t, '2026-10-12', '2026-10-16');
    await t.click('[data-range="24h"]');
    expect(t.$('datesText').textContent).toBe('Zeitraum wählen');
    expect(t.$('datesBtn').getAttribute('aria-pressed')).toBe('false');
    expect(t.$('rangeGroup').querySelector('[data-range="24h"]')!.getAttribute('aria-pressed')).toBe('true');
    expect(t.$('winCo2').textContent).toBe('2.11., 07:36 – 3.11., 07:36 · ppm');
    await pick(t, '2026-10-12', '2026-10-16');
    await t.click('[data-range="7d"]');
    expect(t.$('datesBtn').getAttribute('aria-pressed')).toBe('false');
  });
  it('the charts get the chosen range as axis', async () => {
    const e = fakeEcharts();
    const t = await startTestApp({ echarts: e.api });
    await pick(t, '2026-10-12', '2026-10-16');
    const o = e.charts[0].options.at(-1) as any;
    expect([o.xAxis.min, o.xAxis.max]).toEqual([Date.parse('2026-10-11T22:00:00Z'), Date.parse('2026-10-16T22:00:00Z')]);
  });
  it('the room panel, lamp, values and Heute do not change', async () => {
    const t = await startTestApp({ echarts: fakeEcharts().api });
    const ids = ['status', 'why', 'vCo2', 'vTemp', 'vHum', 'fresh', 'vAbove', 'vPeak', 'vAired', 'light'];
    const read = () => [...ids.map((i) => t.$(i).textContent + '|' + (t.$(i).getAttribute('aria-label') ?? '')), t.$('app').dataset.air, t.$('app').dataset.state];
    const before = read();
    await pick(t, '2026-10-12', '2026-10-16');
    expect(read()).toEqual(before);
    await pick(t, '2026-01-01', '2026-10-31');
    expect(read()).toEqual(before);
    expect(t.historyQueries().at(-1)).toContain('every: 1d');
  });
});
