// @vitest-environment happy-dom
// The room list view and the room choice (platform-room-picker, tasks 3.4 to 4.3): the page against
// fake retained messages, a fake clock and the stored readings of all rooms.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { BASE, disposeApps, startTestApp } from './harness';
import { fixture } from './helpers';

afterEach(disposeApps);
const T = (room: string) => `leoiot/room-climate/${room}`;
const reading = (room: string, extra: Record<string, unknown> = {}, ts = BASE - 10_000) => ({ room, device: 'nili3', source: 'sensor', ts, ...extra });
const texts = (selector: string) => [...document.querySelectorAll(selector)].map((e) => e.textContent);
const items = () => [...document.querySelectorAll<HTMLElement>('#rooms li')];
const item = (room: string) => items().find((li) => li.querySelector('.rid')!.textContent === room)!;

describe('room list view (no room in the address)', () => {
  it('shows the list, hides the room panel, charts and range, subscribes to every room', async () => {
    const t = await startTestApp({ search: '' });
    await t.connect();
    expect(t.$('app').dataset.view).toBe('list');
    expect(t.mqtt.subscribed).toEqual(['leoiot/room-climate/#']);
    expect(document.title).toBe('Räume · LeoIoT Raumklima');
    expect(t.$('rangeGroup').hidden).toBe(true);
    expect(t.$('roomSelect').hidden).toBe(true);
    expect(t.$('allRooms').getAttribute('aria-current')).toBe('page');
    expect(t.$('allRooms').hasAttribute('href')).toBe(false);
    expect(t.queries).toHaveLength(0); // live channel works: no stored readings are read
  });
  it('groups the retained rooms by floor, in building order', async () => {
    const t = await startTestApp({ search: '' });
    await t.connect();
    t.mqtt.message(T('105'), reading('105', { co2: 1120 }));
    t.mqtt.message(T('E10'), reading('E10', { co2: 500 }));
    t.mqtt.message(T('1Aula'), reading('1Aula', { co2: 700 }));
    t.mqtt.message(T('X99'), reading('X99', { co2: 700 }));
    expect(texts('#roomsBody h3')).toEqual(['Erdgeschoss', '1. Stock', 'Weitere Räume']);
    expect(texts('#roomsBody .rid')).toEqual(['E10', '1Aula', '105', 'X99']);
    expect(item('105').querySelector('a')!.getAttribute('href')).toBe('?room=105');
    expect(t.$('roomsMsg').hidden).toBe(true);
  });
  it('air state as text and colour data, CO2 with unit, simulated tag, no CO2 and outdated rooms', async () => {
    const t = await startTestApp({ search: '' });
    await t.connect();
    t.mqtt.message(T('105'), reading('105', { co2: 1120 }, BASE - 60_000));
    t.mqtt.message(T('E10'), reading('E10', { co2: 500, source: 'simulated' }));
    t.mqtt.message(T('106'), reading('106', { temperature: 21 }));
    t.mqtt.message(T('107'), reading('107', { co2: 900 }, BASE - 2 * 3600_000));
    expect(item('105').dataset.air).toBe('bad');
    expect(item('105').querySelector('.rstate')!.textContent).toBe('Jetzt lüften');
    expect(item('105').querySelector('.rco2')!.textContent!.replace(/\s/g, '')).toBe('1120ppm');
    expect(item('E10').querySelector('.rtag')!.textContent).toBe('simuliert');
    expect(item('E10').querySelector<HTMLElement>('.rtag')!.hidden).toBe(false);
    expect(item('105').querySelector<HTMLElement>('.rtag')!.hidden).toBe(true);
    expect(item('106').querySelector('.rstate')!.textContent).toBe('Kein CO₂-Wert');
    expect(item('106').querySelector('.rco2')!.textContent).toBe('–');
    expect(item('106').dataset.air).toBe('off');
    expect(item('107').dataset).toMatchObject({ air: 'off', fresh: 'stale' });
    expect(item('107').querySelector('.rstate')!.textContent).toMatch(/^Nicht aktuell · \d\d:\d\d$/);
    expect(item('105').querySelector('.lamp-dot')!.getAttribute('aria-hidden')).toBe('true');
  });
  it('updates live, in place: the same list element stays, a room goes stale after five minutes', async () => {
    const t = await startTestApp({ search: '' });
    await t.connect();
    t.mqtt.message(T('105'), reading('105', { co2: 500 }, BASE));
    const li = item('105');
    t.mqtt.message(T('105'), reading('105', { co2: 900 }, BASE + 1000));
    expect(item('105')).toBe(li);
    expect(li.dataset.air).toBe('soon');
    expect(li.querySelector('.rstate')!.textContent).toBe('Bald lüften');
    await t.advance(5000 * 62); // more than five minutes without a new message
    expect(item('105')).toBe(li);
    expect(li.dataset.fresh).toBe('stale');
    expect(li.dataset.air).toBe('off');
  });
  it('an empty retained payload removes the room', async () => {
    const t = await startTestApp({ search: '' });
    await t.connect();
    t.mqtt.message(T('105'), reading('105', { co2: 500 }));
    t.mqtt.message(T('E10'), reading('E10', { co2: 500 }));
    t.mqtt.message(T('105'), '');
    expect(texts('#roomsBody .rid')).toEqual(['E10']);
    expect(texts('#roomsBody h3')).toEqual(['Erdgeschoss']);
  });
  it('says that no room is sending when nothing arrives after connecting', async () => {
    const t = await startTestApp({ search: '' });
    await t.connect();
    expect(t.$('roomsMsg').textContent).toBe('Werte werden geladen');
    await t.advance(2500);
    expect(t.$('roomsMsg').hidden).toBe(false);
    expect(t.$('roomsMsg').textContent).toBe('Derzeit sendet kein Raum Messwerte.');
    t.mqtt.message(T('105'), reading('105', { co2: 500 }));
    expect(t.$('roomsMsg').hidden).toBe(true);
  });
  it('live channel down: the rooms come from the stored readings once a minute, with a note', async () => {
    const t = await startTestApp({ search: '', rooms: fixture('latestRooms.csv') });
    await t.advance(9000);
    expect(t.roomsQueries()).toBe(1);
    expect(texts('#roomsBody .rid')).toEqual(['E10', '105']);
    expect(t.$('roomsNote').hidden).toBe(false);
    expect(t.$('roomsNote').textContent).toBe('Aktualisierung jede Minute');
    await t.advance(60_000);
    expect(t.roomsQueries()).toBe(2);
    await t.connect();
    expect(t.$('roomsNote').hidden).toBe(true);
  });
  it('language and theme buttons work; the list switches language', async () => {
    const t = await startTestApp({ search: '' });
    await t.connect();
    t.mqtt.message(T('E10'), reading('E10', { co2: 500 }));
    await t.click('[data-lang="en"]');
    expect(texts('#roomsBody h3')).toEqual(['Ground floor']);
    expect(item('E10').querySelector('.rstate')!.textContent).toBe('Air is fine');
    expect(t.$('roomsTitle').textContent).toBe('Rooms with readings');
    expect(document.title).toBe('Rooms · LeoIoT Room climate');
    expect(t.$('allRooms').textContent).toBe('All rooms');
    await t.click('#theme');
    expect(document.documentElement.dataset.theme).toBe('dark');
  });
});

describe('room page', () => {
  it('?room=105 shows the room page and subscribes to every room', async () => {
    const t = await startTestApp({ search: '?room=105' });
    await t.connect();
    expect(t.$('app').dataset.view).toBe('room');
    expect(t.mqtt.subscribed).toEqual(['leoiot/room-climate/#']);
    expect(t.$('roomId').textContent).toBe('105');
    expect(t.$('rangeGroup').hidden).toBe(false);
    expect(t.$('allRooms').getAttribute('href')).toBe('./');
    expect(t.$('allRooms').hasAttribute('aria-current')).toBe(false);
  });
  it('messages of other rooms feed the choice only; messages of the shown room feed the panel', async () => {
    const t = await startTestApp({ search: '?room=105' });
    await t.connect();
    t.mqtt.message(T('E10'), reading('E10', { co2: 2000 }, BASE + 1000));
    expect(t.$('vCo2').textContent!.replace(/\s/g, '')).toBe('1070');
    const select = t.$('roomSelect') as HTMLSelectElement;
    expect([...select.options].map((o) => o.value)).toEqual(['E10', '105']);
    expect([...select.querySelectorAll('optgroup')].map((g) => g.label)).toEqual(['Erdgeschoss', '1. Stock']);
    t.mqtt.message(T('105'), reading('105', { co2: 640 }, BASE + 2000));
    expect(t.$('vCo2').textContent).toBe('640');
    t.mqtt.message(T('105'), ''); // cleared retained message: the panel ignores it
    expect(t.$('vCo2').textContent).toBe('640');
  });
  it('choosing E10 navigates to ?room=E10; the shown room stays selected', async () => {
    const t = await startTestApp({ search: '?room=105' });
    await t.connect();
    t.mqtt.message(T('E10'), reading('E10', { co2: 500 }));
    const select = t.$('roomSelect') as HTMLSelectElement;
    expect(select.value).toBe('105');
    select.value = 'E10';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    expect(t.navigated).toEqual(['?room=E10']);
  });
  it('the choice is only rebuilt when the set of rooms changes', async () => {
    const t = await startTestApp({ search: '?room=105' });
    await t.connect();
    t.mqtt.message(T('E10'), reading('E10', { co2: 500 }));
    const option = (t.$('roomSelect') as HTMLSelectElement).options[0];
    t.mqtt.message(T('E10'), reading('E10', { co2: 600 }, BASE + 1000));
    await t.advance(3000);
    expect((t.$('roomSelect') as HTMLSelectElement).options[0]).toBe(option);
  });
  it('the shown room is selected even without data; an unknown room shows "Keine Daten" and the list below', async () => {
    const t = await startTestApp({ search: '?room=X99', latest: fixture('latestX99.csv') });
    await t.connect();
    t.mqtt.message(T('105'), reading('105', { co2: 500 }));
    expect(t.$('app').dataset.state).toBe('nodata');
    expect((t.$('roomSelect') as HTMLSelectElement).value).toBe('X99');
    expect(t.$('emptyTitle').textContent).toBe('Keine Daten für Raum X99');
    expect(t.$('emptyText').textContent).toBe('Für diesen Raum liegen keine Messwerte vor.');
    expect(t.$('status').textContent).toBe('');
    const rooms = t.$('rooms');
    expect(rooms.compareDocumentPosition(t.$('empty')) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy(); // the list comes after the message
    expect(texts('#roomsBody .rid')).toEqual(['105']);
    expect(item('105').querySelector('a')!.getAttribute('href')).toBe('?room=105');
  });
  it('an invalid room in the address still gets the list', async () => {
    const t = await startTestApp({ search: '?room=a%2Fb' });
    await t.connect();
    t.mqtt.message(T('105'), reading('105', { co2: 500 }));
    expect(t.$('emptyTitle').textContent).toBe('Keine Daten für Raum a/b');
    expect(texts('#roomsBody .rid')).toEqual(['105']);
    expect(t.queries).toHaveLength(0);
  });
  it('links to the room in the 3D explorer for rooms of a known floor only', async () => {
    const t = await startTestApp({ search: '?room=105' });
    const link = t.$('link3d') as HTMLAnchorElement;
    expect(link.hidden).toBe(false);
    expect(link.getAttribute('href')).toBe('/3d/?room=105');
    expect(link.textContent).toBe('Im Gebäude zeigen');
    await t.click('[data-lang="en"]');
    expect(link.textContent).toBe('Show in the building');
    disposeApps();
    const x = await startTestApp({ search: '?room=X99', latest: fixture('latestX99.csv') });
    expect(x.$('link3d').hidden).toBe(true);
    disposeApps();
    const u = await startTestApp({ search: '?room=U74.1', latest: fixture('latestX99.csv') });
    expect(u.$('link3d').getAttribute('href')).toBe('/3d/?room=U74.1');
  });
  it('the list is hidden by the stylesheet unless the room has no data', async () => {
    const t = await startTestApp({ search: '?room=105' });
    expect(t.$('app').dataset.state).toBe('live');
    const css = readFileSync(resolve(__dirname, '..', 'src/styles/app.css'), 'utf8');
    expect(css).toContain(".rooms { display: none;");
    expect(css).toContain("[data-view='room'][data-state='nodata'] .rooms");
  });
  it('fallback fills the list from the stored rooms while the live channel is down', async () => {
    const t = await startTestApp({ search: '?room=X99', latest: fixture('latestX99.csv'), rooms: fixture('latestRooms.csv') });
    await t.advance(9000);
    expect(t.roomsQueries()).toBe(1);
    expect(texts('#roomsBody .rid')).toEqual(['E10', '105']);
    expect(t.$('roomsNote').hidden).toBe(false);
  });
});
