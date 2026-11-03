// @vitest-environment happy-dom
// Task 4.3: the room panel as rendered DOM (src/ui/render.ts). The lamps are lit by the page's
// stylesheet from `data-air` on #app, so the stylesheet rules are checked together with the attribute.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Lang } from '../src/core/i18n';
import { makeFormat } from '../src/core/format';
import type { Air } from '../src/core/air';
import { applyLive, EMPTY_SNAPSHOT, type Snapshot } from '../src/core/snapshot';
import { deriveRoomView, type RoomView } from '../src/core/view';
import { bindDom, renderRoom, type Dom } from '../src/ui/render';
import { loadPage, vienna } from './helpers';

const css = readFileSync(resolve(__dirname, '..', 'src/styles/app.css'), 'utf8');

let dom: Dom;
beforeEach(() => {
  loadPage(document);
  dom = bindDom(document);
});

const at = vienna('10:41');
const snap = (co2: number | undefined, when: number, extra: Partial<Snapshot['samples']> = {}, source: 'sensor' | 'simulated' = 'sensor', devices = ['nili3']): Snapshot => ({
  samples: { ...(co2 === undefined ? {} : { co2: { value: co2, at: when } }), ...extra },
  source,
  devices,
  at: when,
});
const series = (from: string, to: string, co2: (i: number) => number) => {
  const n = (vienna(to) - vienna(from)) / 300_000;
  return Array.from({ length: n + 1 }, (_, i) => ({ t: vienna(from) + i * 300_000, co2: co2(i) }));
};

function show(view: RoomView, now: number, lang: Lang = 'de', room = { id: '105', valid: true }, feed: 'live' | 'fallback' = 'live') {
  renderRoom(dom, view, { lang, room, now, feed }, makeFormat(lang));
}
const live = (s: Snapshot, now: number, series24h: { t: number; co2: number | null }[] | null = null) => deriveRoomView({ snapshot: s, series24h, now, status: 'ok' });
const text = (el: HTMLElement) => el.textContent;

/** The lamps the stylesheet lights for a value of `data-air`. */
function litLamps(air: string): string[] {
  return ['r', 'y', 'g'].filter((c) => css.includes(`[data-air='${air}'] .lamp.${c} {`));
}

describe('The air state is shown as a traffic light', () => {
  it('three lamps; exactly one is lit for each state, none when off', () => {
    expect(document.querySelectorAll('#light .lamp')).toHaveLength(3);
    expect(litLamps('good')).toEqual(['g']);
    expect(litLamps('soon')).toEqual(['y']);
    expect(litLamps('bad')).toEqual(['r']);
    expect(litLamps('off')).toEqual([]);
  });
  it.each([
    [799, 'good', 'Luft gut', 'Ampel grün', 'Air is fine', 'Light green'],
    [800, 'soon', 'Bald lüften', 'Ampel gelb', 'Air the room soon', 'Light amber'],
    [1000, 'soon', 'Bald lüften', 'Ampel gelb', 'Air the room soon', 'Light amber'],
    [1001, 'bad', 'Jetzt lüften', 'Ampel rot', 'Air the room now', 'Light red'],
  ] as const)('thresholds: %d ppm lights %s, the sentence and the name of the light match', (ppm, air: Air, de, deLamp, en, enLamp) => {
    show(live(snap(ppm, at), at), at);
    expect(dom.app.dataset.air).toBe(air);
    expect(litLamps(dom.app.dataset.air!)).toHaveLength(1);
    expect(text(dom.status)).toBe(de);
    expect(dom.light.getAttribute('aria-label')).toBe(deLamp);
    expect(text(dom.cells.co2.value).replace(/\s/g, '')).toBe(String(ppm)); // 1 000 has a thousands separator
    show(live(snap(ppm, at), at), at, 'en');
    expect(text(dom.status)).toBe(en);
    expect(dom.light.getAttribute('aria-label')).toBe(enLamp);
  });
  it('the state is not told by colour alone: status sentence, name of the light and a reason', () => {
    for (const ppm of [500, 900, 1200]) {
      show(live(snap(ppm, at), at), at);
      expect(text(dom.status)).not.toBe('');
      expect(text(dom.why)).not.toBe('');
      expect(dom.light.getAttribute('aria-label')).toMatch(/^Ampel /);
    }
    expect(dom.light.getAttribute('role')).toBe('img');
  });
  it('green says CO₂ is below 800 ppm', () => {
    show(live(snap(640, at), at), at);
    expect(text(dom.why)).toBe('CO₂ liegt unter 800 ppm.');
  });
  it('above the limit for a while: yellow, "Bald lüften" and since when', () => {
    const s = series('09:00', '10:40', (i) => (i < 11 ? 600 : 830));
    show(live(snap(868, at), at, s), at);
    expect(dom.app.dataset.air).toBe('soon');
    expect(text(dom.status)).toBe('Bald lüften');
    expect(text(dom.why)).toBe('CO₂ liegt seit 09:55 über 800 ppm.');
    show(live(snap(868, at), at, s), at, 'en');
    expect(text(dom.why)).toBe('CO₂ has been above 800 ppm since 09:55.');
  });
  it('red names the limit of 1000 ppm and its own run', () => {
    const s = series('09:00', '10:40', (i) => (i < 11 ? 850 : i < 15 ? 950 : 1100));
    show(live(snap(1150, at), at, s), at);
    expect(dom.app.dataset.air).toBe('bad');
    expect(text(dom.why)).toBe('CO₂ liegt seit 10:15 über 1000 ppm. Fenster weit öffnen.');
  });
  it('a run that reaches back beyond the shown 24 hours says so', () => {
    show(live(snap(868, at), at, series('09:00', '10:40', () => 900)), at);
    expect(text(dom.why)).toBe('CO₂ liegt seit mehr als 24 Stunden über 800 ppm.');
  });
  it('no CO₂ value yet: no lamp, the sentence says so, the other values are shown', () => {
    show(live(snap(undefined, at, { temperature: { value: 21.2, at }, humidity: { value: 40, at } }), at), at);
    expect(dom.app.dataset.air).toBe('off');
    expect(litLamps(dom.app.dataset.air!)).toEqual([]);
    expect(text(dom.status)).toBe('Kein aktueller CO₂-Wert');
    expect(dom.light.getAttribute('aria-label')).toBe('Ampel aus');
    expect(text(dom.cells.co2.value)).toBe('–');
    expect(text(dom.cells.temperature.value)).toBe('21,2');
    expect(text(dom.cells.humidity.value)).toBe('40');
  });
  it('while loading no lamp is lit', () => {
    show(deriveRoomView({ snapshot: EMPTY_SNAPSHOT, series24h: null, now: at, status: 'loading' }), at);
    expect(dom.app.dataset).toMatchObject({ state: 'loading', air: 'off' });
    expect(text(dom.status)).toBe('Werte werden geladen');
  });
});

describe('Current values show their age', () => {
  const full = snap(868, at, { temperature: { value: 21.46, at }, humidity: { value: 39.6, at } });
  it('CO₂ without decimals, temperature with one, humidity without; German and English number format', () => {
    show(live(full, at), at);
    expect([dom.cells.co2, dom.cells.temperature, dom.cells.humidity].map((c) => text(c.value))).toEqual(['868', '21,5', '40']);
    show(live(full, at), at, 'en');
    expect(text(dom.cells.temperature.value)).toBe('21.5');
  });
  it('the time of the latest reading with its age; the age counts up', () => {
    show(live(full, at + 12_000), at + 12_000);
    expect(text(dom.fresh)).toBe('Stand 10:41:00 · vor 12 s');
    show(live(full, at + 72_000), at + 72_000);
    expect(text(dom.fresh)).toBe('Stand 10:41:00 · vor 1 min');
    show(live(full, at + 72_000), at + 72_000, 'en');
    expect(text(dom.fresh)).toBe('As of 10:41:00 · 1 min ago');
  });
  it('the fallback says the values are updated every minute', () => {
    show(live(full, at), at, 'de', { id: '105', valid: true }, 'fallback');
    expect(text(dom.fresh)).toBe('Stand 10:41:00 · vor 0 s · Aktualisierung jede Minute');
  });
  it('unknown quantity: shown as unknown, never as zero', () => {
    show(live(snap(700, at, { temperature: { value: 21, at } }), at), at);
    expect(text(dom.cells.humidity.value)).toBe('–');
    expect(text(dom.cells.humidity.unknown)).toBe('unbekannt');
    expect(text(dom.cells.humidity.value)).not.toBe('0');
    expect(text(dom.cells.temperature.unknown)).toBe('');
  });
  it('a quantity that has not been delivered for five minutes is unknown on a live page', () => {
    const s = snap(700, at, { humidity: { value: 40, at: at - 6 * 60_000 } });
    show(live(s, at), at);
    expect(text(dom.cells.humidity.value)).toBe('–');
  });

  it('new reading: the value cells change in place, the elements stay', () => {
    const cells = [dom.cells.co2.value, dom.cells.temperature.value, dom.cells.humidity.value];
    const parents = cells.map((c) => c.parentElement);
    show(live(full, at), at);
    const next = applyLive(full, { room: '105', device: 'nili3', source: 'sensor', ts: at + 10_000, co2: 905, temperature: 21.9, humidity: 38 });
    const before = [...dom.app.querySelectorAll('*')];
    show(live(next, at + 10_000), at + 10_000);
    expect([dom.cells.co2.value, dom.cells.temperature.value, dom.cells.humidity.value]).toEqual(cells);
    expect(cells.map((c) => document.getElementById(c.id))).toEqual(cells);
    expect(cells.map((c) => c.parentElement)).toEqual(parents);
    expect(cells.map(text)).toEqual(['905', '21,9', '38']);
    expect(dom.app.dataset.air).toBe('soon');
    expect([...dom.app.querySelectorAll('*')]).toEqual(before); // no element added, removed or replaced
  });
  it('an unchanged text is not written again (the live region stays quiet)', () => {
    show(live(full, at + 5000), at + 5000);
    const seen: MutationRecord[] = [];
    const observer = new MutationObserver((r) => seen.push(...r));
    observer.observe(dom.app, { subtree: true, childList: true, characterData: true });
    show(live(full, at + 5000), at + 5000);
    seen.push(...observer.takeRecords());
    expect(seen).toHaveLength(0);
    show(live(full, at + 6000), at + 6000);
    seen.push(...observer.takeRecords());
    expect(seen.length).toBeGreaterThan(0);
    expect(seen.every((m) => dom.fresh.contains(m.target))).toBe(true); // only the age line changed
    observer.disconnect();
  });
});

describe('Outdated values are marked', () => {
  const last = vienna('10:29');
  const old = snap(868, last, { temperature: { value: 21.4, at: last }, humidity: { value: 40, at: last } });
  const now = vienna('10:41');

  it('box stops sending: all lamps off, no current values and the time of the last reading, values greyed, warning symbol', () => {
    show(live(old, now), now);
    expect(dom.app.dataset).toMatchObject({ state: 'stale', air: 'off', fresh: 'stale' });
    expect(litLamps(dom.app.dataset.air!)).toEqual([]);
    expect(text(dom.status)).toBe('Keine aktuellen Werte');
    expect(text(dom.why)).toBe('Letzter Messwert um 10:29, vor 12 Minuten. Die Werte unten sind nicht aktuell.');
    expect(text(dom.fresh)).toBe('Zuletzt 10:29');
    expect(dom.light.getAttribute('aria-label')).toBe('Ampel aus');
    expect(text(dom.cells.co2.value)).toBe('868'); // the last values stay, greyed by the stylesheet
    expect(css).toMatch(/\[data-fresh='stale'\] \.cell \.v \{ color: var\(--ink-3\)/);
    expect(css).toMatch(/\[data-fresh='stale'\] \.fresh \.warn \{ display: block/);
    expect(dom.warn.getAttribute('aria-label')).toBe('Warnung');
    expect(dom.app.querySelector('.fresh .warn')).toBe(dom.warn);
  });
  it('English wording', () => {
    show(live(old, now), now, 'en');
    expect(text(dom.status)).toBe('No current values');
    expect(text(dom.why)).toBe('Last reading at 10:29, 12 minutes ago. The values below are not current.');
  });
  it('simulated readings are called values, not measurements', () => {
    show(live({ ...old, source: 'simulated' }, now), now);
    expect(text(dom.why)).toMatch(/^Letzter Wert um 10:29/);
  });
  it('exactly five minutes old is still current, one second more is outdated', () => {
    show(live(old, last + 300_000), last + 300_000);
    expect(dom.app.dataset.state).toBe('live');
    show(live(old, last + 301_000), last + 301_000);
    expect(dom.app.dataset.state).toBe('stale');
  });
  it('box sends again: lamp, sentence and values return to normal, in the same elements', () => {
    show(live(old, now), now);
    const co2 = dom.cells.co2.value;
    const fresh = applyLive(old, { room: '105', device: 'nili3', source: 'sensor', ts: now, co2: 640, temperature: 21.5, humidity: 41 });
    show(live(fresh, now), now);
    expect(dom.app.dataset).toMatchObject({ state: 'live', air: 'good', fresh: 'live' });
    expect(text(dom.status)).toBe('Luft gut');
    expect(text(dom.fresh)).toBe('Stand 10:41:00 · vor 0 s');
    expect(dom.cells.co2.value).toBe(co2);
    expect(text(co2)).toBe('640');
  });
});

describe('Rooms without data say so', () => {
  const none = (status: 'ok' | 'invalid' | 'error' = 'ok') => deriveRoomView({ snapshot: EMPTY_SNAPSHOT, series24h: null, now: at, status });
  it('unknown room: "Keine Daten für Raum X99", no lamps, values or charts', () => {
    show(none(), at, 'de', { id: 'X99', valid: true });
    expect(dom.app.dataset.state).toBe('nodata');
    expect(dom.app.dataset.air).toBe('off');
    expect(text(dom.emptyTitle)).toBe('Keine Daten für Raum X99');
    expect(text(dom.emptyText)).toMatch(/keine Messwerte/);
    // the stylesheet hides room panel and charts and shows the message for this state
    expect(css).toMatch(/\[data-state='nodata'\] \.room, \[data-state='nodata'\] \.charts,/);
    expect(css).toMatch(/\[data-state='nodata'\] \.empty, \[data-state='error'\] \.empty \{ display: block/);
    expect(text(dom.status)).toBe('');
    expect(text(dom.fresh)).toBe('');
  });
  it('English wording', () => {
    show(none(), at, 'en', { id: 'X99', valid: true });
    expect(text(dom.emptyTitle)).toBe('No data for room X99');
  });
  it('an invalid room id is shown as text, never as markup, and explained', () => {
    show(none('invalid'), at, 'de', { id: '<img src=x onerror=alert(1)>', valid: false });
    expect(dom.app.dataset.state).toBe('nodata');
    expect(text(dom.emptyTitle)).toBe('Keine Daten für Raum <img src=x onerror=alert(1)>');
    expect(dom.emptyTitle.querySelector('img')).toBeNull();
    expect(text(dom.emptyText)).toMatch(/ungültig/);
  });
  it('stored readings that cannot be loaded are an error, not "no data"', () => {
    show(none('error'), at);
    expect(dom.app.dataset.state).toBe('error');
    expect(text(dom.emptyTitle)).toBe('Daten nicht erreichbar');
  });
});

describe('Simulated readings are marked', () => {
  it('"simuliert" next to the room id instead of "gemessen"; the page carries the source for the stylesheet', () => {
    show(live(snap(700, at, {}, 'simulated', ['sim-e10']), at), at, 'de', { id: 'E10', valid: true });
    expect(dom.app.dataset.source).toBe('simulated');
    expect(text(dom.ident)).toBe('Gerät sim-e10·simuliert');
    expect(text(dom.ident)).not.toContain('gemessen');
    expect(dom.ident.querySelector('.tag')!.textContent).toBe('simuliert');
    expect(css).toMatch(/\[data-source='simulated'\] \.ident \.tag \{ border: 1px dashed/);
    show(live(snap(700, at, {}, 'simulated', ['sim-e10']), at), at, 'en');
    expect(dom.ident.querySelector('.tag')!.textContent).toBe('simulated');
  });
  it('measured readings say "gemessen" with the sensor box', () => {
    show(live(snap(700, at), at), at);
    expect(dom.app.dataset.source).toBe('sensor');
    expect(dom.ident.querySelector('.tag')!.textContent).toBe('gemessen');
    expect(text(dom.ident)).toContain('Sensorbox nili3');
    expect(text(dom.ident)).not.toContain('simuliert');
  });
  it('the identity line is rebuilt only when it changes', () => {
    show(live(snap(700, at), at), at);
    const tag = dom.ident.querySelector('.tag');
    show(live(snap(900, at + 1000), at + 1000), at + 1000);
    expect(dom.ident.querySelector('.tag')).toBe(tag);
    show(live(snap(900, at, {}, 'simulated', ['sim-e10']), at), at);
    expect(dom.ident.querySelector('.tag')).not.toBe(tag);
  });
});
