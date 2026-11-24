// Wires everything: the address, saved choices, queries, the live channel with its fallback, the
// once-a-second clock, the room panel and the charts. All outside things are passed in, so tests
// can run the page against fake data and a fake clock.
import { isLive, isRangeId, selectionBounds, selectionKey, type Selection } from './core/ranges';
import { parseLiveMessage, liveTopic } from './core/live';
import { roomFromSearch, type RoomChoice } from './core/room';
import { listEntries } from './core/roomList';
import { applyLive, EMPTY_SNAPSHOT, mergeSnapshots, type HistoryPoint, type Snapshot } from './core/snapshot';
import { deriveRoomView } from './core/view';
import { makeFormat } from './core/format';
import { isLang, type Lang } from './core/i18n';
import type { Query } from './data/api';
import { POLL_MS, type FeedMode, type MqttLike, type Timers } from './data/feed';
import { loadAboveMinutes, loadHistory, loadLatest, loadPeak } from './data/load';
import { startOfLocalDay } from './core/format';
import type { Peak } from './core/today';
import { startRoomsSource, type RoomsSource } from './data/roomsSource';
import { createCharts, type Charts, type EchartsApi } from './ui/charts';
import { readPalette } from './ui/palette';
import { effectiveTheme, KEY_LANG, KEY_THEME, loadPrefs, write, type Theme } from './ui/prefs';
import { createDatesPanel } from './ui/datesPanel';
import { bindRoomListDom, renderRoomChoice, renderRoomList } from './ui/roomList';
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
  /** Opens an address (the header's room choice). Default: the browser's location.assign. */
  navigate?: (href: string) => void;
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
  const found = roomFromSearch(deps.search);
  if (found === null) throw new Error('startApp needs a room in the address; the list view is startListApp');
  const room: RoomChoice = found;
  const listDom = bindRoomListDom(deps.doc);
  const navigate = deps.navigate ?? ((href: string) => deps.doc.defaultView?.location.assign(href));
  const prefs = loadPrefs(deps.storage);

  let lang: Lang = prefs.lang;
  let savedTheme: Theme | null = prefs.theme;
  let selection: Selection = { kind: '24h' };
  let snapshot: Snapshot = EMPTY_SNAPSHOT;
  let latest: 'loading' | 'ok' | 'error' = 'loading';
  let feedMode: FeedMode = 'connecting';
  // One state per selection key: 24h, 7d and one slot for the chosen dates (replaced when other dates are chosen).
  const history = new Map<string, HistoryState>();
  const stateOf = (key: string): HistoryState => history.get(key) ?? { status: 'loading', points: [], source: null, loadedAt: 0 };
  /** The day's highest CO2 reading, loaded with the 24 h history; the last good one stays on errors. */
  let peak: { source: string; value: Peak | null } | null = null;
  /** The minutes above 1000 ppm today, loaded with the peak; the last good one stays on errors. */
  let aboveMinutes: { source: string; value: number } | null = null;
  const inFlight = new Map<string, number>();
  let rooms: RoomsSource | null = null;
  let disposed = false;
  let charts: Charts | null = null;
  let resizer: ResizeObserver | null = null;
  let chartsRequested = false;

  if (savedTheme) deps.doc.documentElement.dataset.theme = savedTheme;
  const theme = (): Theme => effectiveTheme(savedTheme, deps.prefersDark());

  function drawCharts(): void {
    const key = selectionKey(selection);
    const h = stateOf(key);
    const simulated = snapshot.source === 'simulated';
    renderChartFrame(dom, { lang, selection, now: h.loadedAt || deps.now(), history: h.status, empty: h.status === 'ok' && h.points.every((p) => p.co2 === null && p.temperature === null && p.humidity === null) });
    if (!room.valid || (latest === 'ok' && snapshot.at === null)) return;
    if (!charts && deps.charts && !chartsRequested) {
      chartsRequested = true;
      deps.charts().then(
        (api) => {
          if (disposed) return;
          charts = createCharts(api, dom.chartCo2, dom.chartTemp, dom.chartHum);
          // The charts follow the size of their panels (layout changes), not only of the window.
          if (typeof ResizeObserver !== 'undefined') {
            resizer = new ResizeObserver(() => charts?.resize());
            for (const el of [dom.chartCo2, dom.chartTemp, dom.chartHum]) resizer.observe(el);
          }
          drawCharts();
        },
        () => {
          history.set(key, { ...stateOf(key), status: 'error' });
          renderChartFrame(dom, { lang, selection, now: deps.now(), history: 'error', empty: false });
        },
      );
    }
    charts?.render(chartInput({ points: h.points, selection, now: h.loadedAt || deps.now(), lang, palette: readPalette(deps.doc.documentElement), simulated }));
  }

  function drawFrame(): void {
    renderFrame(dom, { lang, room, selection, now: deps.now(), theme: theme() });
  }

  /** The room list (shown below the "no data" panel) and the room choice in the header. */
  function drawRooms(): void {
    const state = rooms?.state ?? new Map();
    renderRoomChoice(listDom, [...state.keys()], room.id, lang);
    const visible = dom.app.dataset.state === 'nodata' || dom.app.dataset.state === 'error';
    if (visible) renderRoomList(listDom, { entries: listEntries(state, deps.now()), ready: rooms?.ready() ?? false, feed: feedMode, failed: rooms?.failed() ?? false, lastLoadAt: rooms?.lastLoadAt() ?? null, lang, filter: null }, makeFormat(lang));
  }

  function drawRoom(): void {
    const now = deps.now();
    const status = !room.valid ? 'invalid' : latest;
    const h24 = stateOf('24h');
    const shownPeak = peak !== null && peak.source === snapshot.source ? peak.value : null;
    // While the 24 h series is not loaded the summary shows dashes (series null), not "no readings".
    const shownMinutes = aboveMinutes !== null && aboveMinutes.source === snapshot.source ? aboveMinutes.value : 0;
    const view = deriveRoomView({ snapshot, series24h: h24.status === 'ok' ? h24.points : null, now, status, peak: shownPeak, aboveMinutes: shownMinutes });
    renderRoom(dom, view, { lang, room, now, feed: feedMode }, makeFormat(lang));
    drawRooms();
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
    refreshCharts();
  }

  /** The 24-hour series always (room panel, status sentence and Heute read it), the shown selection when it still grows or was never loaded. */
  function refreshCharts(): void {
    void refreshHistory({ kind: '24h' });
    if (selection.kind === '24h') return;
    const now = deps.now();
    const loadedAt = stateOf(selectionKey(selection)).loadedAt;
    if (loadedAt === 0 || isLive(selection, now) || selectionBounds(selection, now).end !== selectionBounds(selection, loadedAt).end) void refreshHistory(selection);
  }

  async function refreshHistory(sel: Selection): Promise<void> {
    const source = snapshot.source;
    if (source === null || !room.valid) return;
    const key = selectionKey(sel);
    const is24 = sel.kind === '24h';
    const seq = (inFlight.get(key) ?? 0) + 1;
    inFlight.set(key, seq);
    const now = deps.now();
    // The day's peak and minutes above 1000 ppm are read together with the 24 h series; the failure of either alone keeps its last good value.
    const aboveLoad = is24 ? loadAboveMinutes(deps.query, room.id, source, startOfLocalDay(now), now).then((value) => ({ value }), () => null) : null;
    const peakLoad = is24 ? loadPeak(deps.query, room.id, source, startOfLocalDay(now), now).then((value) => ({ value }), () => null) : null;
    try {
      const points = await loadHistory(deps.query, room.id, source, sel, now);
      const peakAnswer = await peakLoad;
      const aboveAnswer = await aboveLoad;
      if (disposed || seq !== inFlight.get(key)) return;
      if (peakAnswer !== null) peak = { source, value: peakAnswer.value };
      if (aboveAnswer !== null) aboveMinutes = { source, value: aboveAnswer.value };
      history.set(key, { status: 'ok', points, source, loadedAt: now });
    } catch {
      if (disposed || seq !== inFlight.get(key)) return;
      // Keep the points shown so far; only say so when there is nothing to show.
      const old = stateOf(key);
      history.set(key, { ...old, status: old.points.length > 0 ? 'ok' : 'error' });
    }
    if (key === selectionKey(selection)) drawCharts();
    if (is24) drawRoom(); // "since when" reads the five-minute series
  }

  // --- controls ---
  const onClick = (e: Event) => {
    const target = (e.target as Element | null)?.closest<HTMLElement>('button');
    if (!target) return;
    if (target.dataset.range && isRangeId(target.dataset.range)) {
      selection = { kind: target.dataset.range };
      drawFrame();
      if (selection.kind !== '24h') {
        const h = stateOf(selectionKey(selection));
        if (h.loadedAt === 0 || h.source !== snapshot.source) void refreshHistory(selection);
      } else if (stateOf('24h').loadedAt === 0 || stateOf('24h').source !== snapshot.source) void refreshHistory(selection);
      drawCharts();
    } else if (target.id === 'datesBtn') {
      datesPanel.toggle();
    } else if (target.dataset.lang && isLang(target.dataset.lang)) {
      lang = target.dataset.lang;
      write(deps.storage, KEY_LANG, lang);
      drawFrame();
      datesPanel.relabel();
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
  const datesPanel = createDatesPanel({
    dom,
    lang: () => lang,
    now: deps.now,
    selection: () => selection,
    apply(from, to) {
      selection = { kind: 'dates', from, to };
      const key = selectionKey(selection);
      for (const k of [...history.keys()]) if (k.startsWith('dates:') && k !== key) history.delete(k);
      drawFrame();
      const h = stateOf(key);
      if (h.loadedAt === 0 || h.source !== snapshot.source || isLive(selection, deps.now())) void refreshHistory(selection);
      drawCharts();
    },
  });
  deps.doc.querySelector('header')?.addEventListener('click', onClick);
  const onChoose = () => {
    if (listDom.select.value !== '') navigate(`?room=${encodeURIComponent(listDom.select.value)}`);
  };
  listDom.select.addEventListener('change', onChoose);
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
  // One subscription to every room: the header choice and the list under "no data" need all of
  // them; the messages of the shown room also feed the room panel.
  const shownTopic = room.valid ? liveTopic(room.id) : null;
  rooms = startRoomsSource({
    connect: deps.connect,
    query: deps.query,
    timers,
    now: deps.now,
    extraPoll: room.valid ? refreshLatest : undefined,
    onMessage: (topic, payload) => {
      if (topic !== shownTopic || payload.length === 0) return; // a cleared message only concerns the list
      const reading = parseLiveMessage(payload, room.id);
      if (!reading) return;
      const sourceBefore = snapshot.source;
      snapshot = applyLive(snapshot, reading);
      latest = latest === 'error' ? 'ok' : latest;
      drawRoom();
      if (snapshot.source !== sourceBefore) {
        refreshCharts();
      }
    },
    onChange: () => {
      feedMode = rooms?.mode() ?? feedMode;
      drawRoom();
    },
  });
  if (room.valid) {
    void refreshLatest();
    // The charts and the five-minute series follow the clock; a failed first load is tried again.
    refresher = timers.setInterval(() => {
      if (latest !== 'ok') void refreshLatest();
      else refreshCharts();
    }, POLL_MS);
  }
  clock = timers.setInterval(drawRoom, 1000);

  return {
    dispose() {
      disposed = true;
      rooms?.stop();
      if (clock !== null) timers.clearInterval(clock);
      if (refresher !== null) timers.clearInterval(refresher);
      datesPanel.dispose();
      resizer?.disconnect();
      charts?.dispose();
      deps.doc.querySelector('header')?.removeEventListener('click', onClick);
      listDom.select.removeEventListener('change', onChoose);
    },
  };
}
