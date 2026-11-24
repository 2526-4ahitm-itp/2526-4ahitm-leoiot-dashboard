// Runs the whole page (startApp) in a DOM against fake data, a fake broker and a fake clock.
import { startApp, type App } from '../src/app';
import { roomFromSearch } from '../src/core/room';
import { startListApp } from '../src/listApp';
import type { EchartsApi } from '../src/ui/charts';
import { FakeMqtt, FakeTimers, fixture, flush, loadPage } from './helpers';

/** The test "now": 06:36:30 UTC, 07:36:30 in Vienna (winter time), 22 s after the recorded latest answer. */
export const BASE = Date.parse('2026-11-03T06:36:30Z');

export class MemoryStorage {
  data = new Map<string, string>();
  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
}

/** A storage that throws on every access (private window, blocked site data). */
export class BrokenStorage {
  getItem(): string | null {
    throw new Error('blocked');
  }
  setItem(): void {
    throw new Error('blocked');
  }
}

/** Answer of the latest query for room 105, with the CO2 value and the time replaced. */
export function latestCsv(co2: number, iso = '2026-11-03T06:36:08Z'): string {
  return fixture('latest105.csv').replace('2026-11-03T06:36:08Z', iso).replace(',1070,', `,${co2},`);
}

export interface FakeChart {
  el: HTMLElement;
  group: string;
  options: Record<string, unknown>[];
  disposed: boolean;
}

export function fakeEcharts() {
  const charts: FakeChart[] = [];
  const connected: string[] = [];
  const api: EchartsApi = {
    init(el) {
      const chart: FakeChart = { el, group: '', options: [], disposed: false };
      charts.push(chart);
      return {
        get group() {
          return chart.group;
        },
        set group(g: string) {
          chart.group = g;
        },
        setOption: (o) => void chart.options.push(o as Record<string, unknown>),
        resize: () => {},
        dispose: () => void (chart.disposed = true),
      };
    },
    connect: (g) => void connected.push(g),
  };
  return { api, charts, connected };
}

/** The query for the latest values of every room (no room in its filter). */
/** The query counting the minutes above 1000 ppm (one-minute windows). */
const isAboveQuery = (flux: string) => flux.includes('every: 1m');
const isRoomsQuery = (flux: string) => flux.includes('last()') && !flux.includes('r.room ==');

export interface TestAppOptions {
  /** The address's query string; default room 105. An address without a room starts the room list. */
  search?: string;
  storage?: MemoryStorage | BrokenStorage | null;
  prefersDark?: boolean;
  latest?: string;
  history?: string;
  echarts?: EchartsApi | null;
  /** Answer of the latest-values query for all rooms (the room list's fallback). Default: no rows. */
  rooms?: string;
  /** Answer of the day's peak query (`max()`). Default: room 105's recorded answer. */
  peak?: string;
  /** Answer of the minutes-above-1000-ppm query (`count()`). Default: no row (none). */
  above?: string;
  /** The stored readings cannot be reached (every query fails). */
  failing?: boolean;
}

const apps: App[] = [];
export function disposeApps(): void {
  for (const a of apps.splice(0)) a.dispose();
}

export async function startTestApp(o: TestAppOptions = {}) {
  loadPage(document);
  const timers = new FakeTimers();
  const mqtt = new FakeMqtt();
  const queries: string[] = [];
  const state = { latest: o.latest ?? fixture('latest105.csv'), history: o.history ?? fixture('history24h.csv'), prefersDark: o.prefersDark ?? false, fail: o.failing ?? false, rooms: o.rooms ?? '', peak: o.peak ?? fixture('peak105.csv'), above: o.above ?? '' };
  const storage = o.storage === undefined ? new MemoryStorage() : o.storage;
  let schemeListener: (() => void) | null = null;
  const search = o.search ?? '?room=105';
  const navigated: string[] = [];
  /** The address's query string, as the list view keeps it with replaceState. */
  const address = { search };
  const deps = {
    doc: document,
    storage: storage as unknown as Storage | null,
    prefersDark: () => state.prefersDark,
    query: async (flux: string) => {
      queries.push(flux);
      if (state.fail) throw new Error('HTTP 502');
      if (isRoomsQuery(flux)) return state.rooms;
      if (isAboveQuery(flux)) return state.above;
      if (flux.includes('max()')) return state.peak;
      return flux.includes('last()') ? state.latest : state.history;
    },
    connect: () => mqtt,
    charts: o.echarts ? async () => o.echarts as EchartsApi : null,
    now: () => BASE + timers.now,
    timers,
    onSchemeChange: (l: () => void) => void (schemeListener = l),
  };
  // A room in the address starts the room page, none the room list (as src/main.ts does).
  const app = roomFromSearch(search) ? startApp({ ...deps, search, navigate: (href) => void navigated.push(href) }) : startListApp({ ...deps, search, replaceSearch: (next) => void (address.search = next) });
  apps.push(app);
  await flush();
  const $ = (id: string) => document.getElementById(id) as HTMLElement;
  const click = async (selector: string) => {
    (document.querySelector(selector) as HTMLElement).click();
    await flush();
  };
  return {
    app,
    timers,
    mqtt,
    queries,
    navigated,
    address,
    state,
    storage,
    $,
    click,
    latestQueries: () => queries.filter((q) => q.includes('last()') && !isRoomsQuery(q)).length,
    roomsQueries: () => queries.filter(isRoomsQuery).length,
    historyQueries: () => queries.filter((q) => !q.includes('last()') && !q.includes('max()') && !isAboveQuery(q)),
    aboveQueries: () => queries.filter(isAboveQuery),
    peakQueries: () => queries.filter((q) => q.includes('max()')),
    /** The broker connection comes up (the subscription is granted at once). */
    async connect() {
      mqtt.emit('connect');
      await flush();
    },
    async advance(ms: number) {
      timers.advance(ms);
      await flush();
    },
    changeScheme(dark: boolean) {
      state.prefersDark = dark;
      schemeListener?.();
    },
  };
}
