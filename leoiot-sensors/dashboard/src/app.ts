// Wires everything: the address, saved choices, queries, the live channel with its fallback, the
// once-a-second clock, the room panel and the charts. All outside things are passed in, so tests
// can run the page against fake data and a fake clock.
import { isRangeId, DEFAULT_RANGE, type RangeId } from './core/ranges';
import { roomFromSearch } from './core/room';
import { applyLive, EMPTY_SNAPSHOT, mergeSnapshots, type HistoryPoint, type Snapshot } from './core/snapshot';
import { deriveRoomView } from './core/view';
import { makeFormat } from './core/format';
import { isLang, type Lang } from './core/i18n';
import type { Query } from './data/api';
import { startFeed, POLL_MS, type Feed, type FeedMode, type MqttLike, type Timers } from './data/feed';
import { loadHistory, loadLatest } from './data/load';
import { createCharts, type Charts, type EchartsApi } from './ui/charts';
import { readPalette } from './ui/palette';
import { effectiveTheme, KEY_LANG, KEY_THEME, loadPrefs, write, type Theme } from './ui/prefs';
import { bindDom, chartInput, renderChartFrame, renderFrame, renderRoom, type HistoryStatus } from './ui/render';

export interface AppDeps {
  doc: Document;
  search: string;
  storage: Storage | null;
  /** True when the browser prefers a dark colour scheme. */
  prefersDark: () => boolean;
  query: Query;
  connect: () => MqttLike | Promise<MqttLike>;
  /** Loads ECharts (a separate file, fetched after the first paint). Null: no charts. */
  charts: (() => Promise<EchartsApi>) | null;
  now: () => number;
  timers?: Timers;
  /** Called when the colour scheme of the system changes, to redraw the charts. */
  onSchemeChange?: (listener: () => void) => void;
}

export interface App {
  dispose(): void;
}

interface HistoryState {
  status: HistoryStatus;
  points: HistoryPoint[];
  source: string | null;
  loadedAt: number;
}

export function startApp(deps: AppDeps): App {
  const timers: Timers = deps.timers ?? (globalThis as unknown as Timers);
  const dom = bindDom(deps.doc);
  const room = roomFromSearch(deps.search);
  const prefs = loadPrefs(deps.storage);

  let lang: Lang = prefs.lang;
  let savedTheme: Theme | null = prefs.theme;
  let range: RangeId = DEFAULT_RANGE;
  let snapshot: Snapshot = EMPTY_SNAPSHOT;
  let latest: 'loading' | 'ok' | 'error' = 'loading';
  let feedMode: FeedMode = 'connecting';
  const history: Record<RangeId, HistoryState> = {
    '24h': { status: 'loading', points: [], source: null, loadedAt: 0 },
    '7d': { status: 'loading', points: [], source: null, loadedAt: 0 },
  };
  const inFlight: Record<RangeId, number> = { '24h': 0, '7d': 0 };
  let feed: Feed | null = null;
  let disposed = false;
  let charts: Charts | null = null;
  let resizer: ResizeObserver | null = null;
  let chartsRequested = false;

  if (savedTheme) deps.doc.documentElement.dataset.theme = savedTheme;
  const theme = (): Theme => effectiveTheme(savedTheme, deps.prefersDark());

  function drawCharts(): void {
    const h = history[range];
    const simulated = snapshot.source === 'simulated';
    renderChartFrame(dom, { lang, range, now: h.loadedAt || deps.now(), history: h.status, empty: h.status === 'ok' && h.points.every((p) => p.co2 === null && p.temperature === null && p.humidity === null) });
    if (!room.valid || (latest === 'ok' && snapshot.at === null)) return;
    if (!charts && deps.charts && !chartsRequested) {
      chartsRequested = true;
      deps.charts().then(
        (api) => {
          if (disposed) return;
          charts = createCharts(api, dom.chartTemp, dom.chartAir);
          // The charts follow the size of their panels (layout changes), not only of the window.
          if (typeof ResizeObserver !== 'undefined') {
            resizer = new ResizeObserver(() => charts?.resize());
            resizer.observe(dom.chartTemp);
            resizer.observe(dom.chartAir);
          }
          drawCharts();
        },
        () => {
          history[range] = { ...history[range], status: 'error' };
          renderChartFrame(dom, { lang, range, now: deps.now(), history: 'error', empty: false });
        },
      );
    }
    charts?.render(chartInput({ points: h.points, range, now: h.loadedAt || deps.now(), lang, palette: readPalette(deps.doc.documentElement), simulated }));
  }

  function drawFrame(): void {
    renderFrame(dom, { lang, room, range, theme: theme() });
  }

  function drawRoom(): void {
    const now = deps.now();
    const status = !room.valid ? 'invalid' : latest;
    const view = deriveRoomView({ snapshot, series24h: history['24h'].points, now, status });
    renderRoom(dom, view, { lang, room, now, feed: feedMode }, makeFormat(lang));
  }

  async function refreshLatest(): Promise<void> {
    try {
      snapshot = mergeSnapshots(snapshot, await loadLatest(deps.query, room.id));
      latest = 'ok';
    } catch {
      if (latest === 'loading') latest = 'error';
    }
    if (disposed) return;
    drawRoom();
    void refreshHistory('24h');
    if (range !== '24h') void refreshHistory(range);
  }

  async function refreshHistory(r: RangeId): Promise<void> {
    const source = snapshot.source;
    if (source === null || !room.valid) return;
    const seq = ++inFlight[r];
    const now = deps.now();
    try {
      const points = await loadHistory(deps.query, room.id, source, r, now);
      if (disposed || seq !== inFlight[r]) return;
      history[r] = { status: 'ok', points, source, loadedAt: now };
    } catch {
      if (disposed || seq !== inFlight[r]) return;
      // Keep the points shown so far; only say so when there is nothing to show.
      history[r] = { ...history[r], status: history[r].points.length > 0 ? 'ok' : 'error' };
    }
    if (r === range) drawCharts();
    if (r === '24h') drawRoom(); // "since when" reads the five-minute series
  }

  // --- controls ---
  const onClick = (e: Event) => {
    const target = (e.target as Element | null)?.closest<HTMLElement>('button');
    if (!target) return;
    if (target.dataset.range && isRangeId(target.dataset.range)) {
      range = target.dataset.range;
      drawFrame();
      if (history[range].loadedAt === 0 || history[range].source !== snapshot.source) void refreshHistory(range);
      drawCharts();
    } else if (target.dataset.lang && isLang(target.dataset.lang)) {
      lang = target.dataset.lang;
      write(deps.storage, KEY_LANG, lang);
      drawFrame();
      drawRoom();
      drawCharts();
    } else if (target.id === 'theme') {
      savedTheme = theme() === 'dark' ? 'light' : 'dark';
      deps.doc.documentElement.dataset.theme = savedTheme;
      write(deps.storage, KEY_THEME, savedTheme);
      drawFrame();
      drawCharts();
    }
  };
  deps.doc.querySelector('header')?.addEventListener('click', onClick);
  deps.onSchemeChange?.(() => {
    drawFrame();
    drawCharts();
  });

  // --- start ---
  drawFrame();
  drawRoom();
  drawCharts();

  let clock: unknown = null;
  let refresher: unknown = null;
  if (room.valid) {
    feed = startFeed({
      room: room.id,
      connect: deps.connect,
      poll: refreshLatest,
      onReading: (reading) => {
        const sourceBefore = snapshot.source;
        snapshot = applyLive(snapshot, reading);
        latest = latest === 'error' ? 'ok' : latest;
        drawRoom();
        if (snapshot.source !== sourceBefore) {
          void refreshHistory('24h');
          if (range !== '24h') void refreshHistory(range);
        }
      },
      onMode: (mode) => {
        feedMode = mode;
        drawRoom();
      },
      timers,
    });
    void refreshLatest();
    // The charts and the five-minute series follow the clock; a failed first load is tried again.
    refresher = timers.setInterval(() => {
      if (latest !== 'ok') void refreshLatest();
      else {
        void refreshHistory('24h');
        if (range !== '24h') void refreshHistory(range);
      }
    }, POLL_MS);
    clock = timers.setInterval(drawRoom, 1000);
  }

  return {
    dispose() {
      disposed = true;
      feed?.stop();
      if (clock !== null) timers.clearInterval(clock);
      if (refresher !== null) timers.clearInterval(refresher);
      resizer?.disconnect();
      charts?.dispose();
      deps.doc.querySelector('header')?.removeEventListener('click', onClick);
    },
  };
}
