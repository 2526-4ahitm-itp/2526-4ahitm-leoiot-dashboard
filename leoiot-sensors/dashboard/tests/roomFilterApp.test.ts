// @vitest-environment happy-dom
// The room list's search field and floor filter (sensors-range-calendar-room-filter, task 2.2).
import { afterEach, describe, expect, it } from 'vitest';
import { BASE, disposeApps, startTestApp } from './harness';

afterEach(disposeApps);
const T = (room: string) => `leoiot/room-climate/${room}`;
const reading = (room: string, extra: Record<string, unknown> = {}, ts = BASE - 10_000) => ({ room, device: 'nili3', source: 'sensor', ts, ...extra });
const texts = (selector: string) => [...document.querySelectorAll(selector)].map((e) => e.textContent);
const search = () => document.getElementById('roomsSearch') as HTMLInputElement;
const floorButtons = () => [...document.querySelectorAll<HTMLButtonElement>('#roomsFloors button')];
const pressed = () => floorButtons().filter((b) => b.getAttribute('aria-pressed') === 'true').map((b) => b.dataset.floor);
const rooms = () => texts('#roomsBody .rid');

type T = Awaited<ReturnType<typeof startTestApp>>;
const type = async (t: T, value: string) => {
  search().value = value;
  search().dispatchEvent(new Event('input', { bubbles: true }));
  await t.advance(0);
};
const chooseFloor = async (t: T, floor: string) => {
  document.querySelector<HTMLElement>(`#roomsFloors [data-floor="${floor}"]`)!.click();
  await t.advance(0);
};
/** Seven rooms on four floors, one of them of no known floor. */
async function start(search = '') {
  const t = await startTestApp({ search });
  await t.connect();
  for (const r of ['E10', 'E11', '105', '106', '1Aula', '210', 'X99']) t.mqtt.message(T(r), reading(r, { co2: r === '106' ? 1200 : 500 }));
  return t;
}

describe('the toolbar', () => {
  it('is hidden until rooms are listed, then offers the search and "Alle" plus each floor with rooms', async () => {
    const t = await startTestApp({ search: '' });
    await t.connect();
    expect(t.$('roomsTools').hidden).toBe(true);
    t.mqtt.message(T('E10'), reading('E10', { co2: 500 }));
    expect(t.$('roomsTools').hidden).toBe(false);
    expect(floorButtons().map((b) => b.textContent)).toEqual(['Alle', 'Erdgeschoss']);
    t.mqtt.message(T('105'), reading('105', { co2: 500 }));
    t.mqtt.message(T('X99'), reading('X99', { co2: 500 }));
    expect(floorButtons().map((b) => [b.dataset.floor, b.textContent])).toEqual([['all', 'Alle'], ['E', 'Erdgeschoss'], ['1', '1. Stock'], ['other', 'Weitere Räume']]);
    expect(pressed()).toEqual(['all']);
    expect(t.$('roomsFloors').getAttribute('role')).toBe('group');
    expect(t.$('roomsFloors').getAttribute('aria-label')).toBe('Stockwerk');
  });
  it('the field: a search field with a placeholder and a label for screen readers', async () => {
    const t = await start();
    expect(search().type).toBe('search');
    expect(search().placeholder).toBe('Raum suchen');
    const label = document.querySelector<HTMLLabelElement>('label[for="roomsSearch"]')!;
    expect(label.textContent).toBe('Raum suchen');
    expect(label.classList.contains('sr-only')).toBe(true);
    await t.click('[data-lang="en"]');
    expect(search().placeholder).toBe('Find room');
    expect(label.textContent).toBe('Find room');
    expect(t.$('roomsFloors').getAttribute('aria-label')).toBe('Floor');
    expect(floorButtons().map((b) => b.textContent)).toEqual(['All', 'Ground floor', 'Floor 1', 'Floor 2', 'Other rooms']);
  });
  it('is not shown on the room page without data', async () => {
    const t = await startTestApp({ search: '?room=999' });
    expect(t.$('roomsTools').hidden).toBe(true);
  });
});

describe('searching', () => {
  it('shows the matching rooms by floor and says how many of all rooms', async () => {
    const t = await start();
    expect(t.$('roomsResult').hidden).toBe(true);
    await type(t, '10');
    expect(rooms()).toEqual(['E10', '105', '106', '210']);
    expect(texts('#roomsBody h3 > span:first-child')).toEqual(['Erdgeschoss', '1. Stock', '2. Stock']);
    expect(t.$('roomsResult').textContent).toBe('4 von 7 Räumen');
    expect(t.$('roomsResult').getAttribute('aria-live')).toBe('polite');
    expect(t.$('roomsNoMatch').hidden).toBe(true);
  });
  it('the summary line keeps counting all rooms; the floor headings count the rooms shown', async () => {
    const t = await start();
    const all = t.$('roomsSummary').textContent;
    expect(all).toBe('7 Räume · 1 jetzt lüften');
    await type(t, '10');
    expect(t.$('roomsSummary').textContent).toBe(all);
    expect(texts('#roomsBody .fcount')).toEqual([' · 1 Raum', ' · 2 Räume · 1 jetzt lüften', ' · 1 Raum']);
  });
  it('ignores case and spaces; clearing the field shows everything and hides the result line', async () => {
    const t = await start();
    await type(t, ' e 1 0');
    expect(rooms()).toEqual(['E10']);
    await type(t, '');
    expect(rooms()).toHaveLength(7);
    expect(t.$('roomsResult').hidden).toBe(true);
  });
  it('Escape in the field clears it and keeps the focus there', async () => {
    const t = await start();
    search().focus();
    await type(t, 'aula');
    expect(rooms()).toEqual(['1Aula']);
    const e = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    search().dispatchEvent(e);
    await t.advance(0);
    expect(e.defaultPrevented).toBe(true);
    expect(search().value).toBe('');
    expect(rooms()).toHaveLength(7);
    expect(document.activeElement).toBe(search());
    expect(t.address.search).toBe('');
  });
  it('"/" focuses the field unless focus is in a field already', async () => {
    const t = await start();
    const slash = (target: Element) => {
      const e = new KeyboardEvent('keydown', { key: '/', bubbles: true, cancelable: true });
      target.dispatchEvent(e);
      return e.defaultPrevented;
    };
    expect(slash(document.body)).toBe(true);
    expect(document.activeElement).toBe(search());
    await type(t, 'a');
    expect(slash(search())).toBe(false);
    expect(search().value).toBe('a');
    document.querySelector<HTMLAnchorElement>('#roomsBody a')!.focus();
    expect(slash(document.activeElement!)).toBe(true);
    expect(document.activeElement).toBe(search());
  });
});

describe('the floor filter', () => {
  it('shows one floor and marks it; the summary still counts all rooms', async () => {
    const t = await start();
    await chooseFloor(t, '1');
    expect(rooms()).toEqual(['1Aula', '105', '106']);
    expect(pressed()).toEqual(['1']);
    expect(t.$('roomsResult').textContent).toBe('3 von 7 Räumen');
    expect(t.$('roomsSummary').textContent).toBe('7 Räume · 1 jetzt lüften');
    await chooseFloor(t, 'other');
    expect(rooms()).toEqual(['X99']);
    await chooseFloor(t, 'all');
    expect(rooms()).toHaveLength(7);
    expect(pressed()).toEqual(['all']);
    expect(t.$('roomsResult').hidden).toBe(true);
  });
  it('combines with the search', async () => {
    const t = await start();
    await chooseFloor(t, '1');
    await type(t, '10');
    expect(rooms()).toEqual(['105', '106']);
    expect(t.$('roomsResult').textContent).toBe('2 von 7 Räumen');
    await chooseFloor(t, 'E');
    expect(rooms()).toEqual(['E10']);
    expect(t.$('roomsResult').textContent).toBe('1 von 7 Räumen');
  });
  it('a floor that vanishes falls back to "Alle"', async () => {
    const t = await start();
    await chooseFloor(t, '2');
    expect(rooms()).toEqual(['210']);
    t.mqtt.message(T('210'), '');
    expect(floorButtons().map((b) => b.dataset.floor)).toEqual(['all', 'E', '1', 'other']);
    expect(pressed()).toEqual(['all']);
    expect(rooms()).toHaveLength(6);
    expect(t.$('roomsResult').hidden).toBe(true);
  });
  it('the buttons are rebuilt only when the floors or the language change', async () => {
    const t = await start();
    const before = floorButtons();
    await chooseFloor(t, '1');
    t.mqtt.message(T('105'), reading('105', { co2: 900 }, BASE + 1000));
    await t.advance(5000);
    expect(floorButtons()).toEqual(before);
    t.mqtt.message(T('U01'), reading('U01', { co2: 500 }));
    expect(floorButtons()).toHaveLength(before.length + 1);
    expect(floorButtons()[1].dataset.floor).toBe('U');
  });
});

describe('no match', () => {
  it('says so, offers to reset, and hides the result line', async () => {
    const t = await start();
    await chooseFloor(t, 'E');
    await type(t, 'xyz');
    expect(rooms()).toEqual([]);
    expect(t.$('roomsNoMatch').hidden).toBe(false);
    expect(t.$('roomsNoMatchText').textContent).toBe('Kein Raum passt zu „xyz“.');
    expect(t.$('roomsReset').textContent).toBe('Filter zurücksetzen');
    expect(t.$('roomsResult').hidden).toBe(true);
    expect(t.$('roomsSummary').textContent).toBe('7 Räume · 1 jetzt lüften');
    await t.click('[data-lang="en"]');
    expect(t.$('roomsNoMatchText').textContent).toBe('No room matches “xyz”.');
    expect(t.$('roomsReset').textContent).toBe('Reset filter');
  });
  it('the button resets search and floor, and puts the focus into the field', async () => {
    const t = await start();
    await chooseFloor(t, 'E');
    await type(t, 'xyz');
    await t.click('#roomsReset');
    expect(search().value).toBe('');
    expect(pressed()).toEqual(['all']);
    expect(rooms()).toHaveLength(7);
    expect(t.$('roomsNoMatch').hidden).toBe(true);
    expect(document.activeElement).toBe(search());
    expect(t.address.search).toBe('');
  });
  it('the message follows new rooms', async () => {
    const t = await start();
    await type(t, 'k77');
    expect(t.$('roomsNoMatch').hidden).toBe(false);
    t.mqtt.message(T('K77'), reading('K77', { co2: 500 }));
    expect(t.$('roomsNoMatch').hidden).toBe(true);
    expect(rooms()).toEqual(['K77']);
  });
});

describe('the address', () => {
  it('starts with the filter of the address', async () => {
    const t = await start('?floor=1&q=10');
    expect(search().value).toBe('10');
    expect(pressed()).toEqual(['1']);
    expect(rooms()).toEqual(['105', '106']);
    expect(t.$('roomsResult').textContent).toBe('2 von 7 Räumen');
  });
  it('an unknown floor in the address means all floors; a floor still to arrive does not break the start', async () => {
    const t = await startTestApp({ search: '?floor=9' });
    await t.connect();
    t.mqtt.message(T('E10'), reading('E10', { co2: 500 }));
    expect(pressed()).toEqual(['all']);
    const u = await startTestApp({ search: '?floor=1' });
    await u.connect();
    u.mqtt.message(T('E10'), reading('E10', { co2: 500 }));
    expect(rooms()).toEqual(['E10']); // no floor 1 yet: all rooms are shown
    u.mqtt.message(T('105'), reading('105', { co2: 500 }));
    expect(rooms()).toEqual(['105']); // it arrived: the address's floor applies again
    expect(pressed()).toEqual(['1']);
  });
  it('follows every change, without empty values', async () => {
    const t = await start();
    expect(t.address.search).toBe('');
    await type(t, '10');
    expect(t.address.search).toBe('?q=10');
    await chooseFloor(t, '1');
    expect(t.address.search).toBe('?floor=1&q=10');
    await type(t, '');
    expect(t.address.search).toBe('?floor=1');
    await chooseFloor(t, 'all');
    expect(t.address.search).toBe('');
    await type(t, '  e 10 ');
    expect(t.address.search).toBe('?q=e+10');
    await type(t, '   ');
    expect(t.address.search).toBe('');
  });
  it('keeps other parameters of the address', async () => {
    const t = await start('?x=1');
    await type(t, 'e');
    expect(t.address.search).toBe('?x=1&q=e');
    await type(t, '');
    expect(t.address.search).toBe('?x=1');
  });
  it('a room link leaves the filter in the list address (going back shows it again)', async () => {
    const t = await start();
    await chooseFloor(t, 'E');
    expect(t.address.search).toBe('?floor=E');
    expect(document.querySelector<HTMLAnchorElement>('#roomsBody a')!.getAttribute('href')).toBe('?room=E10');
    const u = await start(t.address.search); // the page the back button loads
    expect(pressed()).toEqual(['E']);
    expect(rooms()).toEqual(['E10', 'E11']);
    expect(u.address.search).toBe('?floor=E');
  });
});

describe('live updates', () => {
  it('values update while the visitor types: the field keeps its text and focus', async () => {
    const t = await start();
    search().focus();
    await type(t, '10');
    t.mqtt.message(T('105'), reading('105', { co2: 1300 }, BASE + 1000));
    t.mqtt.message(T('E10'), reading('E10', { co2: 900 }, BASE + 1000));
    await t.advance(5000);
    await t.advance(5000);
    expect(search().value).toBe('10');
    expect(document.activeElement).toBe(search());
    expect(rooms()).toEqual(['E10', '105', '106', '210']);
    const item = [...document.querySelectorAll('#roomsBody li')].find((li) => li.querySelector('.rid')!.textContent === '105')!;
    expect(item.querySelector('.rco2')!.textContent!.replace(/\s/g, '')).toBe('1300ppm');
  });
  it('a room that appears while filtered is shown when it matches', async () => {
    const t = await start();
    await type(t, 'e1');
    expect(rooms()).toEqual(['E10', 'E11']);
    t.mqtt.message(T('E12'), reading('E12', { co2: 500 }));
    t.mqtt.message(T('E20'), reading('E20', { co2: 500 }));
    expect(rooms()).toEqual(['E10', 'E11', 'E12']);
    expect(t.$('roomsResult').textContent).toBe('3 von 9 Räumen');
  });
  it('the list in the other language keeps the filter', async () => {
    const t = await start();
    await chooseFloor(t, '1');
    await t.click('[data-lang="en"]');
    expect(pressed()).toEqual(['1']);
    expect(t.$('roomsResult').textContent).toBe('3 of 7 rooms');
  });
});
