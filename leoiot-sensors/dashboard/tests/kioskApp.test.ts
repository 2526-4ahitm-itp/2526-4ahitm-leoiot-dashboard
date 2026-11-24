// @vitest-environment happy-dom
// The hallway display (`?kiosk`): the page against fake retained messages and a fake clock.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { startKioskApp } from '../src/kioskApp';
import type { App } from '../src/app';
import { BASE } from './harness';
import { FakeMqtt, FakeTimers, fixture, flush, loadPage } from './helpers';

const apps: App[] = [];
afterEach(() => {
  for (const a of apps.splice(0)) a.dispose();
  vi.restoreAllMocks();
});

const T = (room: string) => `leoiot/room-climate/${room}`;
const reading = (room: string, extra: Record<string, unknown> = {}, ts = BASE - 10_000) => ({ room, device: 'nili3', source: 'sensor', ts, ...extra });
const $ = (id: string) => document.getElementById(id) as HTMLElement;
const texts = (selector: string) => [...document.querySelectorAll(selector)].map((e) => e.textContent);

async function start(search = '?kiosk', o: { rooms?: string; failing?: boolean } = {}) {
  loadPage(document);
  const timers = new FakeTimers();
  const mqtt = new FakeMqtt();
  const reload = vi.fn();
  const queries: string[] = [];
  const app = startKioskApp({
    doc: document,
    search,
    reload,
    now: () => BASE + timers.now,
    timers,
    connect: () => mqtt,
    query: async (flux) => {
      queries.push(flux);
      if (o.failing) throw new Error('HTTP 502');
      return o.rooms ?? '';
    },
  });
  apps.push(app);
  await flush();
  return {
    timers, mqtt, reload, queries,
    async connect() {
      mqtt.emit('connect');
      await flush();
    },
    async advance(ms: number) {
      timers.advance(ms);
      await flush();
    },
    send: (id: string, extra: Record<string, unknown> = {}, ts = BASE + timers.now - 10_000) => mqtt.message(T(id), reading(id, extra, ts)),
  };
}

/** Floor E with 3 rooms, floor 1 with 29 (two pages of 15 and 14 at the default size), floor 2 with 2. */
function school(t: Awaited<ReturnType<typeof start>>) {
  for (const id of ['E10', 'E11', 'E12']) t.send(id, { co2: 500 });
  for (let i = 1; i <= 29; i++) t.send(`1${String(i).padStart(2, '0')}`, { co2: 600 });
  for (const id of ['201', '202']) t.send(id, { co2: 500 });
}
const page = () => `${$('kioskFloorName').textContent}${$('kioskFloorPart').textContent ? ` ${$('kioskFloorPart').textContent}` : ''}`;
const shown = () => texts('#kioskGrid .rid');

describe('hallway display', () => {
  it('replaces the page: kiosk visible, top bar and other views hidden, dark and German by default, title', async () => {
    const t = await start();
    await t.connect();
    expect($('kiosk').hidden).toBe(false);
    expect(document.querySelector<HTMLElement>('header.bar')!.hidden).toBe(true);
    expect($('app').hidden).toBe(true);
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(document.documentElement.lang).toBe('de');
    expect(document.title).toBe('Raumklima · LeoIoT');
    expect(t.mqtt.subscribed).toEqual(['leoiot/room-climate/#']);
    expect($('kioskTitle').textContent).toBe('Raumklima');
  });
  it('shows the school-wide counts, the clock and the date in the school time', async () => {
    const t = await start();
    await t.connect();
    t.send('E10', { co2: 1100 });
    t.send('E11', { co2: 900 });
    t.send('201', { co2: 500 });
    expect($('kioskSummary').textContent).toBe('3 Räume · 1 jetzt lüften · 1 bald lüften');
    expect($('kioskClock').textContent).toBe('07:36');
    expect($('kioskDate').textContent).toMatch(/Dienstag/);
    expect($('kioskDate').textContent).toMatch(/3\. November/);
    await t.advance(60_000);
    expect($('kioskClock').textContent).toBe('07:37');
  });
  it('pages through the floors in building order every 15 seconds, a long floor in two parts, then starts again', async () => {
    const t = await start();
    await t.connect();
    school(t);
    expect(page()).toBe('Erdgeschoss');
    expect(shown()).toEqual(['E10', 'E11', 'E12']);
    await t.advance(14_999);
    expect(page()).toBe('Erdgeschoss');
    await t.advance(1);
    expect(page()).toBe('1. Stock 1/2');
    expect(shown()).toHaveLength(15);
    expect(shown()[0]).toBe('101');
    await t.advance(15_000);
    expect(page()).toBe('1. Stock 2/2');
    expect(shown()).toHaveLength(14);
    expect(shown()[0]).toBe('116');
    await t.advance(15_000);
    expect(page()).toBe('2. Stock');
    expect($('kioskFloorPart').textContent).toBe('');
    await t.advance(15_000);
    expect(page()).toBe('Erdgeschoss');
  });
  it('the footer names the floors with the current one marked, and a progress line that restarts per page', async () => {
    const t = await start();
    await t.connect();
    school(t);
    const floors = () => [...document.querySelectorAll<HTMLElement>('#kioskFloors li')];
    expect(floors().map((li) => li.textContent)).toEqual(['Erdgeschoss', '1. Stock', '2. Stock']);
    expect(floors().map((li) => li.dataset.current)).toEqual(['true', 'false', 'false']);
    const first = document.querySelector('.k-prog');
    expect(first).not.toBeNull();
    expect(first!.parentElement).toBe(floors()[0]);
    expect($('kiosk').style.getPropertyValue('--page-s')).toBe('15s');
    await t.advance(15_000);
    expect(floors().map((li) => li.dataset.current)).toEqual(['false', 'true', 'false']);
    expect(document.querySelectorAll('.k-prog')).toHaveLength(1);
    expect(document.querySelector('.k-prog')).not.toBe(first);
    expect(document.querySelector('.k-prog')!.parentElement).toBe(floors()[1]);
    // Data on the page on screen does not restart the line.
    const running = document.querySelector('.k-prog');
    t.send('105', { co2: 650 });
    await t.advance(5000);
    expect(document.querySelector('.k-prog')).toBe(running);
  });
  it('one page only: no cycling and no progress line', async () => {
    const t = await start();
    await t.connect();
    t.send('E10', { co2: 500 });
    t.send('E11', { co2: 500 });
    const li = document.querySelector('#kioskGrid li');
    await t.advance(60_000);
    expect(page()).toBe('Erdgeschoss');
    expect(document.querySelector('#kioskGrid li')).toBe(li);
    expect(document.querySelector('.k-prog')).toBeNull();
  });
  it('the page time from the address: seconds=30', async () => {
    const t = await start('?kiosk&seconds=30');
    await t.connect();
    school(t);
    await t.advance(29_999);
    expect(page()).toBe('Erdgeschoss');
    await t.advance(1);
    expect(page()).toBe('1. Stock 1/2');
    expect($('kiosk').style.getPropertyValue('--page-s')).toBe('30s');
  });
  it('floor=1 shows only that floor, the attention list and the counts still cover the school', async () => {
    const t = await start('?kiosk&floor=1');
    await t.connect();
    school(t);
    t.send('E10', { co2: 1200 });
    expect(page()).toBe('1. Stock 1/2');
    await t.advance(15_000);
    expect(page()).toBe('1. Stock 2/2');
    await t.advance(15_000);
    expect(page()).toBe('1. Stock 1/2');
    expect(texts('#kioskFloors li')).toEqual(['1. Stock']);
    expect(texts('#kioskBadList .rid')).toEqual(['E10']);
    expect($('kioskSummary').textContent).toBe('34 Räume · 1 jetzt lüften');
  });
  it('a floor that does not exist in the data counts as all floors', async () => {
    const t = await start('?kiosk&floor=T');
    await t.connect();
    t.send('E10', { co2: 500 });
    expect(page()).toBe('Erdgeschoss');
  });
  it('lang=en and theme=light', async () => {
    const t = await start('?kiosk&lang=en&theme=light');
    await t.connect();
    t.send('E10', { co2: 1100 });
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(document.documentElement.lang).toBe('en');
    expect($('kioskSummary').textContent).toBe('1 room · 1 air now');
    expect($('kioskFloorName').textContent).toBe('Ground floor');
    expect($('kioskBadName').textContent).toBe('Air now');
    expect(document.title).toBe('Room climate · LeoIoT');
    expect($('kioskFreshText').textContent).toBe('Live values');
  });
  it('attention: rooms of every floor, bad before soon, highest first; it updates while another floor is on screen', async () => {
    const t = await start();
    await t.connect();
    school(t);
    expect($('kioskGood').hidden).toBe(false);
    expect($('kioskGood').textContent).toBe('Alle Räume haben gute Luft.');
    expect($('kioskBad').hidden).toBe(true);
    await t.advance(10_000);
    t.send('105', { co2: 1060 }, BASE + t.timers.now - 1000);
    t.send('117', { co2: 1300 }, BASE + t.timers.now - 1000);
    t.send('E11', { co2: 900 }, BASE + t.timers.now - 1000);
    expect(page()).toBe('Erdgeschoss'); // the floor on screen stays
    expect(texts('#kioskBadList .rid')).toEqual(['117', '105']);
    expect(texts('#kioskSoonList .rid')).toEqual(['E11']);
    expect($('kioskBadCount').textContent).toBe('2');
    expect($('kioskSoonCount').textContent).toBe('1');
    expect($('kioskGood').hidden).toBe(true);
    expect($('kioskBad').querySelector('li')!.dataset.air).toBe('bad');
    // The page timer was not restarted by the data: the next page comes 15 s after the start.
    await t.advance(5000);
    expect(page()).toBe('1. Stock 1/2');
    t.send('117', { co2: 500 }, BASE + t.timers.now - 1000);
    expect(texts('#kioskBadList .rid')).toEqual(['105']);
  });
  it('more rooms than fit: "+ N more" instead of a cut-off list', async () => {
    const t = await start();
    await t.connect();
    for (let i = 1; i <= 15; i++) t.send(`1${String(i).padStart(2, '0')}`, { co2: 1100 + i });
    expect(texts('#kioskBadList .rid')).toHaveLength(9); // 11 lines: a heading, nine rooms and the "+ N more" line
    expect(texts('#kioskBadList .rid')[0]).toBe('115');
    expect($('kioskMore').hidden).toBe(false);
    expect($('kioskMore').textContent).toBe('+ 6 weitere');
    expect($('kioskBadCount').textContent).toBe('15');
  });
  it('tiles keep the rules of the list: states, outdated with the time, dashed simulated, no CO2', async () => {
    const t = await start();
    await t.connect();
    t.send('E10', { co2: 1120 });
    t.send('E11', { co2: 500, source: 'simulated' });
    t.send('E12', { temperature: 21 });
    t.send('E13', { co2: 900 }, BASE - 2 * 3600_000);
    t.send('E14', { co2: 900 });
    const tile = (id: string) => [...document.querySelectorAll<HTMLElement>('#kioskGrid li')].find((li) => li.querySelector('.rid')!.textContent === id)!;
    expect(tile('E10').dataset.air).toBe('bad');
    expect(tile('E10').querySelector('.rstate')!.textContent).toBe('Jetzt lüften');
    expect(tile('E10').querySelector('.rco2')!.textContent!.replace(/\s/g, '')).toBe('1120ppm');
    expect(tile('E11').dataset.source).toBe('simulated');
    expect(tile('E11').querySelector('.rstate')!.classList.contains('sr-only')).toBe(true);
    expect(tile('E12').querySelector('.rstate')!.textContent).toBe('Kein CO₂-Wert');
    expect(tile('E13').dataset).toMatchObject({ air: 'off', fresh: 'stale' });
    expect(tile('E13').querySelector('.rstate')!.textContent).toMatch(/^Zuletzt \d\d:\d\d$/);
    expect(tile('E13').querySelector('svg.rwarn')).not.toBeNull();
    expect(tile('E14').querySelector('.rstate')!.textContent).toBe('Bald lüften');
    expect($('kioskLegend').hidden).toBe(false);
    expect($('kioskLegend').textContent).toBe('Gestrichelter Rahmen: simulierte Werte');
    expect($('kioskSummary').textContent).toBe('5 Räume · 1 jetzt lüften · 1 bald lüften · 1 nicht aktuell');
    // Outdated rooms are not listed under the attention headings.
    expect(texts('#kioskBadList .rid')).toEqual(['E10']);
    expect(texts('#kioskSoonList .rid')).toEqual(['E14']);
  });
  it('redraws in place: the same tile stays while its value changes; a room that goes away leaves', async () => {
    const t = await start();
    await t.connect();
    t.send('E10', { co2: 500 });
    t.send('E11', { co2: 500 });
    const li = document.querySelector('#kioskGrid li')!;
    t.send('E10', { co2: 900 }, BASE + 1000);
    expect(document.querySelector('#kioskGrid li')).toBe(li);
    expect(li.getAttribute('data-air')).toBe('soon');
    t.mqtt.message(T('E11'), '');
    expect(shown()).toEqual(['E10']);
  });
  it('the position stays on its floor when data changes, and moves on when the floor goes away', async () => {
    const t = await start();
    await t.connect();
    school(t);
    await t.advance(15_000);
    expect(page()).toBe('1. Stock 1/2');
    t.send('203', { co2: 500 });
    t.send('E13', { co2: 500 });
    expect(page()).toBe('1. Stock 1/2');
    for (let i = 1; i <= 29; i++) t.mqtt.message(T(`1${String(i).padStart(2, '0')}`), '');
    expect(page()).toBe('2. Stock'); // the page that took the first floor's place
  });
  it('fewer rooms on a floor: the part that is gone gives way to the last one', async () => {
    const t = await start();
    await t.connect();
    school(t);
    await t.advance(30_000);
    expect(page()).toBe('1. Stock 2/2');
    for (let i = 10; i <= 29; i++) t.mqtt.message(T(`1${String(i).padStart(2, '0')}`), '');
    expect(page()).toBe('1. Stock');
  });
  it('the number of tiles follows the size of the screen', async () => {
    const t = await start();
    await t.connect();
    school(t);
    const grid = $('kioskGrid');
    // 5 x 5 fit at the default size; make the area 3 x 2 tiles and tell the page.
    Object.defineProperty(grid, 'clientWidth', { configurable: true, value: 720 });
    Object.defineProperty(grid, 'clientHeight', { configurable: true, value: 280 });
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1920 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 1080 });
    window.dispatchEvent(new Event('resize'));
    expect($('kioskGrid').style.getPropertyValue('--cols')).toBe('3');
    await t.advance(30_000);
    expect(page()).toMatch(/^1\. Stock \d\/5$/); // 29 rooms, 6 per page
  });
  it('live channel down: stored readings once a minute, with the time of the last load', async () => {
    const t = await start('?kiosk', { rooms: fixture('latestRooms.csv') });
    await t.advance(9000);
    expect(t.queries).toHaveLength(1);
    expect(shown()).toEqual(['E10']); // room 105 is on the first floor, the next page
    expect($('kioskFresh').hidden).toBe(false);
    expect($('kioskFreshText').textContent).toMatch(/^Aktualisierung jede Minute · Stand \d\d:\d\d$/);
    expect($('kioskWarn').hasAttribute('hidden')).toBe(true);
    await t.advance(60_000);
    await t.connect();
    expect($('kioskFreshText').textContent).toBe('Live-Werte');
  });
  it('a stored load that keeps succeeding keeps the triangle away', async () => {
    const t = await start('?kiosk', { rooms: fixture('latestRooms.csv') });
    await t.advance(9000);
    expect($('kioskWarn').hasAttribute('hidden')).toBe(true);
    // The loads keep failing from now on.
    await t.advance(60_000);
    expect($('kioskWarn').hasAttribute('hidden')).toBe(true); // the minute poll succeeded again
  });
  it('a failing load shows the error text and the triangle, never "no room"', async () => {
    const t = await start('?kiosk', { failing: true });
    await t.advance(9000);
    expect($('kioskMsg').hidden).toBe(false);
    expect($('kioskMsg').textContent).toContain('konnten nicht geladen werden');
    expect($('kioskFreshText').textContent).toBe('Aktualisierung jede Minute');
    expect($('kioskWarn').hasAttribute('hidden')).toBe(false);
  });
  it('all rooms outdated: the line says so, with the triangle', async () => {
    const t = await start();
    await t.connect();
    t.send('E10', { co2: 500 });
    expect($('kioskWarn').hasAttribute('hidden')).toBe(true);
    await t.advance(6 * 60_000);
    expect($('kioskFreshText').textContent).toBe('Keine aktuellen Werte');
    expect($('kioskWarn').hasAttribute('hidden')).toBe(false);
  });
  it('reloads the page once, at 03:30 school time', async () => {
    const t = await start();
    await t.connect();
    const due = Date.parse('2026-11-04T02:30:00Z') - BASE;
    await t.advance(due - 1);
    expect(t.reload).not.toHaveBeenCalled();
    await t.advance(1);
    expect(t.reload).toHaveBeenCalledTimes(1);
    await t.advance(3600_000);
    expect(t.reload).toHaveBeenCalledTimes(1);
  });
  it('hides the pointer after three seconds without movement and shows it again on movement', async () => {
    const t = await start();
    await t.connect();
    expect($('kiosk').classList.contains('k-idle')).toBe(false);
    await t.advance(3000);
    expect($('kiosk').classList.contains('k-idle')).toBe(true);
    document.dispatchEvent(new Event('mousemove'));
    expect($('kiosk').classList.contains('k-idle')).toBe(false);
    await t.advance(2999);
    expect($('kiosk').classList.contains('k-idle')).toBe(false);
    await t.advance(1);
    expect($('kiosk').classList.contains('k-idle')).toBe(true);
  });
  it('never touches storage, and ignores a saved theme and language', async () => {
    const set = vi.fn();
    const get = vi.fn((key: string) => (key === 'leoiot-sensors.theme' ? 'light' : key === 'leoiot-sensors.lang' ? 'en' : null));
    vi.stubGlobal('localStorage', { getItem: get, setItem: set, removeItem: vi.fn(), clear: vi.fn() });
    const t = await start();
    await t.connect();
    school(t);
    await t.advance(60_000);
    expect(set).not.toHaveBeenCalled();
    expect(get).not.toHaveBeenCalled();
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(document.documentElement.lang).toBe('de');
    vi.unstubAllGlobals();
  });
  it('no rooms: the loading text, then the "no room sends" text', async () => {
    const t = await start();
    expect($('kioskMsg').textContent).toBe('Werte werden geladen');
    await t.connect();
    await t.advance(2000);
    expect($('kioskMsg').textContent).toBe('Derzeit sendet kein Raum Messwerte.');
    expect($('kioskGood').hidden).toBe(true);
  });
  it('dispose stops the timers and the source', async () => {
    const t = await start();
    await t.connect();
    apps.pop()!.dispose();
    expect(t.mqtt.ended).toBe(true);
    expect(t.timers.pending).toBe(0);
  });
});
