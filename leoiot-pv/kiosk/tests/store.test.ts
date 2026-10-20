import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { createKiosk, type Kiosk } from '../src/data/store';
import { buildView } from '../src/data/view';

const fixture = (name: string): string =>
  readFileSync(new URL(`../../shared/tests/fixtures/${name}.csv`, import.meta.url), 'utf8');

const SPEC = { yield: 746.2, exported: 0, imported: 207, charged: 82.4, discharged: 141.2 };
const ZERO = { yield: 0, exported: 0, imported: 0, charged: 0, discharged: 0 };

type Responder = (flux: string) => string;

let kiosk: Kiosk;
let query: ReturnType<typeof vi.fn>;
let respond: Responder;

const isWeek = (flux: string): boolean => flux.includes('every: 1d');

const ok =
  (today: string, week = 'week'): Responder =>
  (flux) =>
    fixture(isWeek(flux) ? week : today);

async function boot(time: string, responder: Responder): Promise<void> {
  vi.setSystemTime(new Date(time));
  respond = responder;
  query = vi.fn(async (flux: string) => respond(flux));
  kiosk = createKiosk({ query: query as unknown as (f: string) => Promise<string>, now: () => Date.now() });
  kiosk.start();
  await vi.advanceTimersByTimeAsync(0);
}

const view = () => buildView(kiosk.getState(), Date.now());

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  kiosk?.stop();
  vi.useRealTimers();
});

describe('createKiosk', () => {
  it('lädt Tag und Woche', async () => {
    vi.setSystemTime(new Date('2026-10-07T12:03:00Z'));
    respond = ok('today-battery');
    query = vi.fn(async (flux: string) => respond(flux));
    kiosk = createKiosk({ query: query as unknown as (f: string) => Promise<string>, now: () => Date.now() });
    const listener = vi.fn();
    kiosk.subscribe(listener);
    kiosk.start();
    await vi.advanceTimersByTimeAsync(0);
    const s = kiosk.getState();
    expect(s.todayStatus).toBe('ok');
    expect(s.weekStatus).toBe('ok');
    expect(s.rows.length).toBe(168);
    expect(s.dayKey).toBe('2026-10-07');
    expect(s.lastDataAt).toBe(Date.parse('2026-10-07T12:02:30Z'));
    const v = buildView(s, Date.now());
    expect(v.today).toEqual(SPEC);
    expect(v.consumptionTotal).toBeCloseTo(1012, 6);
    expect(v.productionTotal).toBe(746.2);
    expect(v.consumptionShares[0].label).toBe('Von PV');
    expect(v.consumptionShares[0].value).toBeCloseTo(663.8, 6);
    expect(v.week.length).toBe(7);
    expect(v.week[6].key).toBe('2026-10-07');
    expect(v.week[6].consumption).toBeCloseTo(1012, 6);
    expect(v.week[0]).toEqual({ key: '2026-10-01', production: 430, consumption: null, exported: null });
    expect(v.weekLabel).toBe('01.10. – 07.10.2026');
    expect(v.stale).toBe(false);
    expect(v.flow).not.toBeNull();
    expect(v.flow?.source).toBe('average');
    expect(v.power.length).toBe(168);
    expect(listener).toHaveBeenCalled();
    const todayCall = query.mock.calls.map((c) => c[0] as string).find((f) => !isWeek(f));
    expect(todayCall).toContain('range(start: 2026-10-06T22:00:00.000Z, stop: 2026-10-07T22:00:00.000Z)');
  });

  it('erholt sich nach Fehler beim Start ohne Neuladen', async () => {
    await boot('2026-10-07T12:03:00Z', () => {
      throw new Error('aus');
    });
    expect(kiosk.getState().todayStatus).toBe('error');
    expect(kiosk.getState().weekStatus).toBe('error');
    expect(view().today).toBeNull();
    respond = ok('today-battery');
    await vi.advanceTimersByTimeAsync(30_000);
    expect(kiosk.getState().todayStatus).toBe('ok');
    expect(kiosk.getState().weekStatus).toBe('ok');
    expect(kiosk.getState().rows.length).toBe(168);
  });

  it('erkennt veraltete Daten', async () => {
    await boot('2026-10-07T12:03:00Z', ok('today-battery'));
    const late = buildView(kiosk.getState(), Date.parse('2026-10-07T12:20:00Z'));
    expect(late.stale).toBe(true);
    expect(late.lastDataAt).toBe(Date.parse('2026-10-07T12:02:30Z'));
    expect(buildView(kiosk.getState(), Date.parse('2026-10-07T12:07:00Z')).stale).toBe(false);
  });

  it('behält Daten bei Fehler nach Erfolg', async () => {
    await boot('2026-10-07T12:03:00Z', ok('today-battery'));
    respond = () => {
      throw new Error('aus');
    };
    await vi.advanceTimersByTimeAsync(10 * 60_000);
    expect(kiosk.getState().todayStatus).toBe('ok');
    expect(kiosk.getState().rows.length).toBe(168);
    expect(view().stale).toBe(true);
  });

  it('leere Antwort am Tag', async () => {
    await boot('2026-10-07T12:03:00Z', ok('today-empty'));
    expect(kiosk.getState().todayStatus).toBe('empty');
    expect(kiosk.getState().weekStatus).toBe('ok');
    const v = view();
    expect(v.today).toBeNull();
    expect(v.flow).toBeNull();
  });

  it('kurz nach Mitternacht, Zähler noch nicht zurückgesetzt', async () => {
    await boot('2026-10-06T22:04:50Z', ok('today-before-reset'));
    const s = kiosk.getState();
    expect(s.dayKey).toBe('2026-10-07');
    expect(s.todayStatus).toBe('ok');
    const v = view();
    expect(v.today).toEqual(ZERO);
    expect(s.lastDataAt).toBe(Date.parse('2026-10-06T22:04:30Z'));
    expect(v.week.find((d) => d.key === '2026-10-06')?.production).toBe(820.6);
    expect(v.week.find((d) => d.key === '2026-10-07')?.production).toBe(0);
  });

  it('wechselt den Tag', async () => {
    await boot('2026-10-07T21:59:00Z', (flux) =>
      isWeek(flux)
        ? fixture('week')
        : fixture(flux.includes('start: 2026-10-06T22:00:00.000Z') ? 'today-battery' : 'today-empty'),
    );
    expect(kiosk.getState().dayKey).toBe('2026-10-07');
    expect(kiosk.getState().rows.length).toBe(168);
    await vi.advanceTimersByTimeAsync(70_000);
    const s = kiosk.getState();
    expect(s.dayKey).toBe('2026-10-08');
    expect(s.weekKeys[6]).toBe('2026-10-08');
    expect(s.weekKeys[0]).toBe('2026-10-02');
    expect(s.rows.length).toBe(0);
    expect(s.todayStatus).toBe('empty');
    const v = view();
    expect(v.weekLabel).toBe('02.10. – 08.10.2026');
    expect(v.week.find((d) => d.key === '2026-10-07')?.production).toBe(746.2);
    expect(query.mock.calls.some((c) => (c[0] as string).includes('start: 2026-10-07T22:00:00.000Z'))).toBe(true);
  });

  it('übernimmt Live-Leistung', async () => {
    await boot('2026-10-07T12:03:00Z', ok('today-battery'));
    const power = { pv: 30, load: 20, grid: -10, battery: 0 };
    kiosk.handleLive({ kind: 'power', power, t: Date.now() - 30_000 });
    expect(buildView(kiosk.getState(), Date.now()).flow).toEqual({ power, source: 'live' });
    expect(buildView(kiosk.getState(), Date.now() + 3 * 60_000).flow?.source).toBe('average');
  });

  async function liveCounters(): Promise<void> {
    await boot('2026-10-07T12:03:00Z', ok('today-battery'));
    kiosk.handleLive({
      kind: 'counters',
      counters: { ...SPEC, yield: 750 },
      t: Date.parse('2026-10-07T12:03:10Z'),
    });
  }

  it('übernimmt Live-Zähler', async () => {
    await liveCounters();
    expect(view().today?.yield).toBe(750);
    expect(kiosk.getState().lastDataAt).toBe(Date.parse('2026-10-07T12:03:10Z'));
    expect(kiosk.getState().rows.length).toBe(168);
    kiosk.handleLive({
      kind: 'counters',
      counters: { ...SPEC, yield: 751 },
      t: Date.parse('2026-10-07T12:06:00Z'),
    });
    expect(kiosk.getState().rows.length).toBe(169);
    kiosk.handleLive({
      kind: 'counters',
      counters: { ...SPEC, yield: 1 },
      t: Date.parse('2026-10-06T12:00:00Z'),
    });
    expect(kiosk.getState().rows.length).toBe(169);
    expect(view().today?.yield).toBe(751);
  });

  it('Live-Zähler überleben den nächsten Abruf', async () => {
    await liveCounters();
    kiosk.handleLive({
      kind: 'counters',
      counters: { ...SPEC, yield: 751 },
      t: Date.parse('2026-10-07T12:06:00Z'),
    });
    await vi.advanceTimersByTimeAsync(60_000);
    // 12:03:10 ersetzt den Stand desselben Fensters (12:02:30), 12:06:00 kommt dazu
    expect(kiosk.getState().rows.length).toBe(169);
    expect(view().today?.yield).toBe(751);
  });

  it('meldet setLiveConnected nur bei Änderung', async () => {
    await boot('2026-10-07T12:03:00Z', ok('today-battery'));
    const listener = vi.fn();
    kiosk.subscribe(listener);
    kiosk.setLiveConnected(true);
    expect(listener).toHaveBeenCalledTimes(1);
    kiosk.setLiveConnected(true);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('stop beendet alle Abrufe', async () => {
    await boot('2026-10-07T12:03:00Z', ok('today-battery'));
    kiosk.stop();
    const n = query.mock.calls.length;
    await vi.advanceTimersByTimeAsync(10 * 60_000);
    expect(query.mock.calls.length).toBe(n);
  });
});
