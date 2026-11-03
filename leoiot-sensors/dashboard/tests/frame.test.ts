// @vitest-environment happy-dom
// Task 4.1: the frame. Spec "The dashboard is served at /sensors/" and "Languages and themes".
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createQuery } from '../src/data/api';
import { effectiveTheme, isTheme, KEY_LANG, KEY_THEME, loadPrefs, write } from '../src/ui/prefs';
import config from '../vite.config';
import { fixture } from './helpers';
import { BrokenStorage, disposeApps, MemoryStorage, startTestApp } from './harness';

afterEach(disposeApps);
const dashboardFile = (...p: string[]) => readFileSync(resolve(__dirname, '..', ...p), 'utf8');

describe('served at /sensors/', () => {
  it('the build and the dev server use /sensors/ as base', () => {
    expect(config.base).toBe('/sensors/');
    expect(Object.keys(config.server?.proxy ?? {})).toContain('/sensors/api/query');
  });
  it('/sensors redirects to /sensors/, the page is served under /sensors/', () => {
    const nginx = dashboardFile('nginx', 'dashboard.conf.template');
    expect(nginx).toMatch(/location = \/sensors \{\s*return 301 \/sensors\/;/);
    expect(nginx).toMatch(/location \/sensors\/ \{/);
    expect(dashboardFile('Dockerfile')).toMatch(/COPY --from=build \/app\/dist \/usr\/share\/nginx\/html\/sensors\b/);
  });
  it('queries go to /sensors/api/query and carry no credential', async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fake = (async (url: string, init: RequestInit) => (calls.push({ url, init }), new Response('ok'))) as unknown as typeof fetch;
    await createQuery(fake)('flux');
    await createQuery(fake, '/sensors/')('flux');
    expect(calls.map((c) => c.url)).toEqual(['/sensors/api/query', '/sensors/api/query']);
    expect(calls[0].init.method).toBe('POST');
    expect(JSON.stringify(calls[0].init.headers)).not.toMatch(/authorization|token/i);
  });
  it('plain address: the dashboard shows room 105', async () => {
    const t = await startTestApp({ search: '' });
    expect(t.$('roomId').textContent).toBe('105');
    expect(t.$('crumb').textContent).toBe('Raum 105');
    expect(document.title).toBe('Raum 105 · LeoIoT Raumklima');
    expect(t.queries.every((q) => q.includes('r.room == "105"'))).toBe(true);
    expect(t.$('app').dataset.state).toBe('live');
  });
  it('room in the address: the id is shown exactly as on the door sign', async () => {
    const t = await startTestApp({ search: '?room=E10', latest: fixture('latestE10.csv') });
    expect(t.$('roomId').textContent).toBe('E10');
    expect(t.$('crumb').textContent).toBe('Raum E10');
    expect(t.queries[0]).toContain('r.room == "E10"');
    expect(t.$('app').dataset.state).not.toBe('nodata');
  });
});

describe('language and theme are kept in the browser', () => {
  it('first visit: German, theme not chosen yet', () => {
    expect(loadPrefs(new MemoryStorage())).toEqual({ lang: 'de', theme: null });
    expect(loadPrefs(null)).toEqual({ lang: 'de', theme: null });
  });
  it('reads the saved choices and ignores anything else', () => {
    const s = new MemoryStorage();
    s.setItem(KEY_LANG, 'en');
    s.setItem(KEY_THEME, 'dark');
    expect(loadPrefs(s)).toEqual({ lang: 'en', theme: 'dark' });
    s.setItem(KEY_LANG, 'fr');
    s.setItem(KEY_THEME, 'blue');
    expect(loadPrefs(s)).toEqual({ lang: 'de', theme: null });
    expect(isTheme('light') && isTheme('dark') && !isTheme('auto') && !isTheme(null)).toBe(true);
  });
  it('blocked storage does not break the page', () => {
    expect(loadPrefs(new BrokenStorage())).toEqual({ lang: 'de', theme: null });
    expect(() => write(new BrokenStorage(), KEY_LANG, 'en')).not.toThrow();
    expect(() => write(null, KEY_LANG, 'en')).not.toThrow();
  });
  it('the theme follows the system until the visitor chose one', () => {
    expect(effectiveTheme(null, true)).toBe('dark');
    expect(effectiveTheme(null, false)).toBe('light');
    expect(effectiveTheme('light', true)).toBe('light');
    expect(effectiveTheme('dark', false)).toBe('dark');
  });

  it('first visit with a dark system: dark theme in effect, nothing saved, no override on the page', async () => {
    const t = await startTestApp({ prefersDark: true });
    expect(document.documentElement.dataset.theme).toBeUndefined();
    expect(t.$('theme').getAttribute('aria-label')).toBe('Helles Design einschalten');
    expect((t.storage as MemoryStorage).data.size).toBe(0);
  });
  it('first visit with a light system: German and light', async () => {
    const t = await startTestApp({ prefersDark: false });
    expect(document.documentElement.lang).toBe('de');
    expect(t.$('theme').getAttribute('aria-label')).toBe('Dunkles Design einschalten');
    expect(t.$('rangeGroup').querySelector('[data-range="7d"]')!.textContent).toBe('7 Tage');
  });
  it('the system scheme changes before a choice: the button follows', async () => {
    const t = await startTestApp({ prefersDark: false });
    t.changeScheme(true);
    expect(t.$('theme').getAttribute('aria-label')).toBe('Helles Design einschalten');
  });
  it('theme button switches and saves; the system no longer decides', async () => {
    const t = await startTestApp({ prefersDark: true });
    await t.click('#theme');
    expect(document.documentElement.dataset.theme).toBe('light');
    expect((t.storage as MemoryStorage).getItem(KEY_THEME)).toBe('light');
    expect(t.$('theme').getAttribute('aria-label')).toBe('Dunkles Design einschalten');
    await t.click('#theme');
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect((t.storage as MemoryStorage).getItem(KEY_THEME)).toBe('dark');
    t.changeScheme(false);
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(t.$('theme').getAttribute('aria-label')).toBe('Helles Design einschalten');
  });
  it('the saved theme wins over the system on the next visit', async () => {
    const storage = new MemoryStorage();
    storage.setItem(KEY_THEME, 'dark');
    const t = await startTestApp({ storage, prefersDark: false });
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(t.$('theme').getAttribute('aria-label')).toBe('Helles Design einschalten');
  });
  it('the theme works without storage', async () => {
    const t = await startTestApp({ storage: new BrokenStorage(), prefersDark: false });
    await t.click('#theme');
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('switching to English: labels, status sentence, numbers; the choice is kept on the next visit', async () => {
    const storage = new MemoryStorage();
    const t = await startTestApp({ storage });
    expect(t.$('status').textContent).toBe('Jetzt lüften');
    expect(t.$('vTemp').textContent).toBe('21,5');
    expect(t.$('langGroup').querySelector('[data-lang="de"]')!.getAttribute('aria-pressed')).toBe('true');

    await t.click('[data-lang="en"]');
    expect(document.documentElement.lang).toBe('en');
    expect(storage.getItem(KEY_LANG)).toBe('en');
    expect(t.$('langGroup').querySelector('[data-lang="en"]')!.getAttribute('aria-pressed')).toBe('true');
    expect(t.$('status').textContent).toBe('Air the room now');
    expect(t.$('vTemp').textContent).toBe('21.5');
    expect(t.$('kTemp').textContent).toBe('Temperature');
    expect(t.$('kHum').textContent).toBe('Humidity');
    expect(t.$('brandSub').textContent).toBe('Room climate');
    expect(t.$('crumb').textContent).toBe('Room 105');
    expect(t.$('rangeGroup').querySelector('[data-range="7d"]')!.textContent).toBe('7 days');
    expect(t.$('fresh').textContent).toMatch(/^As of 07:36:08 · \d+ s ago$/);
    expect(t.$('winA').textContent).toMatch(/^\d+\/\d+, \d\d:\d\d – \d+\/\d+, \d\d:\d\d · °C$/);
    expect(document.title).toBe('Room 105 · LeoIoT Room climate');

    disposeApps();
    await startTestApp({ storage });
    expect(document.documentElement.lang).toBe('en');
    expect(document.getElementById('status')!.textContent).toBe('Air the room now');
  });
  it('switching back to German', async () => {
    const t = await startTestApp({ storage: new MemoryStorage() });
    await t.click('[data-lang="en"]');
    await t.click('[data-lang="de"]');
    expect(document.documentElement.lang).toBe('de');
    expect(t.$('status').textContent).toBe('Jetzt lüften');
    expect((t.storage as MemoryStorage).getItem(KEY_LANG)).toBe('de');
  });
});

describe('top bar: range', () => {
  it('24 h is the default; 7 Tage switches both charts to the week and states the range', async () => {
    const t = await startTestApp();
    const buttons = () => ['24h', '7d'].map((r) => t.$('rangeGroup').querySelector(`[data-range="${r}"]`)!.getAttribute('aria-pressed'));
    expect(buttons()).toEqual(['true', 'false']);
    expect(t.$('winA').textContent).toBe('2.11., 07:36 – 3.11., 07:36 · °C');
    expect(t.$('winB').textContent).toBe('2.11., 07:36 – 3.11., 07:36');
    await t.click('[data-range="7d"]');
    expect(buttons()).toEqual(['false', 'true']);
    expect(t.$('winA').textContent).toBe('27.10., 07:36 – 3.11., 07:36 · °C');
    expect(t.$('winB').textContent).toBe('27.10., 07:36 – 3.11., 07:36');
    expect(t.$('chartAir').getAttribute('aria-label')).toBe('CO₂ und Luftfeuchte, 27.10., 07:36 – 3.11., 07:36');
    expect(t.historyQueries().at(-1)).toContain('every: 30m');
    await t.click('[data-range="24h"]');
    expect(buttons()).toEqual(['true', 'false']);
  });
});
