// The hallway display's renderer. Like the room list it keeps its elements and only changes text and
// attributes, so that a redraw every few seconds neither flickers nor restarts the progress line.
// Text is only ever set as text, never as HTML, because room ids come from topics.
import type { Format } from '../core/format';
import { floorKey, summarise, type Counts, type FloorEntries, type RoomEntry } from '../core/roomList';
import { texts, type Lang } from '../core/i18n';
import type { FloorId } from '../core/floors';
import { displayRoomId } from '../core/room';
import { attention, fitAttention, tileGrid, type KioskPage } from '../core/kiosk';
import type { FeedMode } from '../data/feed';
import { setAttr, span, stateText, syncChildren, warnIcon } from './roomList';
import { setText } from './render';

/** Heights are in px at 1920 x 1080 and scale with the window (the CSS uses the same factors). */
export const DESIGN_WIDTH = 1920;
export const DESIGN_HEIGHT = 1080;
const GRID_GAP = 16;
/** Height of one line of the attention column (heading, room or "+ N more"). */
export const ATTENTION_LINE = 58;
/** How long without an update counts as outdated. */
export const OUTDATED_MS = 5 * 60_000;

export interface KioskDom {
  doc: Document;
  root: HTMLElement;
  title: HTMLElement;
  sub: HTMLElement;
  summary: HTMLElement;
  clock: HTMLElement;
  date: HTMLElement;
  fresh: HTMLElement;
  warn: Element;
  freshText: HTMLElement;
  floorName: HTMLElement;
  floorCounts: HTMLElement;
  floorPart: HTMLElement;
  msg: HTMLElement;
  grid: HTMLElement;
  attList: HTMLElement;
  bad: HTMLElement;
  badName: HTMLElement;
  badCount: HTMLElement;
  badList: HTMLElement;
  soon: HTMLElement;
  soonName: HTMLElement;
  soonCount: HTMLElement;
  soonList: HTMLElement;
  more: HTMLElement;
  good: HTMLElement;
  floors: HTMLElement;
  legend: HTMLElement;
  tiles: Map<string, Tile>;
  lines: Map<string, Line>;
  footer: Map<string, HTMLElement>;
  /** The progress line in the footer; null while there is only one page. */
  progress: HTMLElement | null;
  /** Floor and part the progress line belongs to. */
  progressKey: string;
}

interface Tile {
  li: HTMLLIElement;
  id: HTMLElement;
  state: HTMLElement;
  value: HTMLElement;
  unit: HTMLElement;
}

interface Line {
  li: HTMLLIElement;
  id: HTMLElement;
  value: HTMLElement;
}

export function bindKioskDom(doc: Document): KioskDom {
  const el = (id: string): HTMLElement => {
    const found = doc.getElementById(id);
    if (!found) throw new Error(`missing element #${id}`);
    return found;
  };
  return {
    doc, root: el('kiosk'), title: el('kioskTitle'), sub: el('kioskSub'), summary: el('kioskSummary'), clock: el('kioskClock'), date: el('kioskDate'),
    fresh: el('kioskFresh'), warn: el('kioskWarn'), freshText: el('kioskFreshText'),
    floorName: el('kioskFloorName'), floorCounts: el('kioskFloorCounts'), floorPart: el('kioskFloorPart'), msg: el('kioskMsg'), grid: el('kioskGrid'),
    attList: el('kioskAttList'), bad: el('kioskBad'), badName: el('kioskBadName'), badCount: el('kioskBadCount'), badList: el('kioskBadList'),
    soon: el('kioskSoon'), soonName: el('kioskSoonName'), soonCount: el('kioskSoonCount'), soonList: el('kioskSoonList'),
    more: el('kioskMore'), good: el('kioskGood'), floors: el('kioskFloors'), legend: el('kioskLegend'),
    tiles: new Map(), lines: new Map(), footer: new Map(), progress: null, progressKey: '',
  };
}

export interface KioskLayout {
  cols: number;
  rows: number;
  /** Height of one tile in px. */
  tileH: number;
  gap: number;
  /** Lines of the attention column. */
  lines: number;
}

/** What fits on the screen now. Without a layout (no window size known) the 1920 x 1080 sizes apply. */
export function measureLayout(dom: KioskDom): KioskLayout {
  const win = dom.doc.defaultView;
  const known = dom.grid.clientWidth > 0 && dom.grid.clientHeight > 0 && !!win;
  const scale = known && win ? Math.min(win.innerWidth / DESIGN_WIDTH, win.innerHeight / DESIGN_HEIGHT) : 1;
  const width = known ? dom.grid.clientWidth : 1380;
  const height = known ? dom.grid.clientHeight : 740;
  const gap = GRID_GAP * scale;
  const { cols, rows } = tileGrid(width, height, scale, gap);
  const attHeight = known && dom.attList.clientHeight > 0 ? dom.attList.clientHeight : 640 * scale;
  return { cols, rows, tileH: Math.floor((height - (rows - 1) * gap) / rows), gap, lines: Math.max(0, Math.floor(attHeight / (ATTENTION_LINE * scale))) };
}

export interface KioskModel {
  lang: Lang;
  now: number;
  /** False until the first answer is in. */
  ready: boolean;
  feed: FeedMode;
  failed: boolean;
  lastLoadAt: number | null;
  /** Every room of the school (summary, attention, legend). */
  entries: FloorEntries[];
  /** The page on screen and how many pages there are; null while there are no rooms. */
  page: KioskPage | null;
  pageCount: number;
  /** The floors of the footer, in order. */
  floors: (FloorId | null)[];
  seconds: number;
  layout: KioskLayout;
}

/** The clock and the date; ticks every second. */
export function renderClock(dom: KioskDom, now: number, format: Format): void {
  setText(dom.clock, format.time(now));
  setText(dom.date, format.longDate(now));
}

function makeTile(doc: Document): Tile {
  const li = doc.createElement('li');
  li.className = 'ktile';
  const lamp = span(doc, 'lamp-dot');
  lamp.setAttribute('aria-hidden', 'true');
  const id = span(doc, 'rid');
  const state = span(doc, 'rstate');
  const co2 = span(doc, 'rco2');
  const value = span(doc, 'v');
  const unit = span(doc, 'u');
  co2.append(value, unit);
  li.append(lamp, warnIcon(doc), id, co2, state);
  return { li, id, state, value, unit };
}

function makeLine(doc: Document): Line {
  const li = doc.createElement('li');
  li.className = 'kline';
  const lamp = span(doc, 'lamp-dot');
  lamp.setAttribute('aria-hidden', 'true');
  const id = span(doc, 'rid');
  const co2 = span(doc, 'rco2');
  const value = span(doc, 'v');
  co2.append(value, span(doc, 'u'));
  li.append(lamp, id, co2);
  return { li, id, value };
}

const setCo2 = (value: HTMLElement, unit: HTMLElement | null, co2: number | null, format: Format, none: string) => {
  setText(value, co2 === null ? none : format.number(co2, 0));
  if (unit) setText(unit, co2 === null ? '' : 'ppm');
};

function renderTile(tile: Tile, e: RoomEntry, t: ReturnType<typeof texts>, format: Format): void {
  tile.li.dataset.air = e.state === 'stale' ? 'off' : e.air ?? 'off';
  tile.li.dataset.fresh = e.state;
  tile.li.dataset.source = e.simulated ? 'simulated' : 'sensor';
  setText(tile.id, displayRoomId(e.room));
  setText(tile.state, stateText(e, t, format));
  tile.state.className = e.state === 'live' && e.air === 'good' ? 'rstate sr-only' : 'rstate';
  setCo2(tile.value, tile.unit, e.co2, format, t.unknown);
}

/** Keeps one element per room in `store` and returns them for the rooms given, dropping the others from the store. */
function keep<T extends { li: HTMLLIElement }>(store: Map<string, T>, rooms: readonly RoomEntry[], make: () => T, fill: (item: T, e: RoomEntry) => void, seen: Set<string>): HTMLElement[] {
  return rooms.map((e) => {
    let item = store.get(e.room);
    if (!item) store.set(e.room, (item = make()));
    fill(item, e);
    seen.add(e.room);
    return item.li;
  });
}

const key = (page: KioskPage | null) => (page === null ? '' : `${page.floor ?? '-'}:${page.part}`);

export function renderKiosk(dom: KioskDom, m: KioskModel, format: Format): void {
  const t = texts(m.lang);
  const doc = dom.doc;
  const summary = summarise(m.entries);
  const empty = m.entries.length === 0;
  doc.title = t.kioskPageTitle;
  setText(dom.title, t.kioskTitle);
  setText(dom.sub, t.kioskSub);
  setText(dom.summary, empty ? '' : t.listCounts(summary.total));
  renderClock(dom, m.now, format);

  // How current the values are: live, or the stored readings once a minute; a triangle when nothing is current.
  const allStale = !empty && summary.total.stale === summary.total.rooms;
  const staleLoad = m.feed === 'fallback' && (m.lastLoadAt === null ? m.failed : m.now - m.lastLoadAt >= OUTDATED_MS);
  const outdated = allStale || staleLoad;
  const freshBase = m.feed === 'live' ? t.listLive : m.feed === 'fallback' ? t.listFallbackAt(m.lastLoadAt === null ? null : format.time(m.lastLoadAt)) : '';
  const freshText = allStale && m.feed === 'live' ? t.kioskOutdated : freshBase;
  setText(dom.freshText, freshText);
  dom.fresh.hidden = freshText === '';
  dom.warn.toggleAttribute('hidden', !outdated);
  dom.fresh.dataset.outdated = String(outdated);

  // Floor page
  const msg = !m.ready ? t.statusLoading : empty ? (m.failed ? t.listLoadError : t.noRooms) : '';
  setText(dom.msg, msg);
  dom.msg.hidden = msg === '';
  const page = m.page;
  setText(dom.floorName, page === null ? '' : t.floorName(page.floor));
  const floorCounts: Counts | undefined = page === null ? undefined : summary.floors.find((f) => f.floor === page.floor)?.counts;
  setText(dom.floorCounts, floorCounts ? ` · ${t.listCounts(floorCounts)}` : '');
  setText(dom.floorPart, page !== null && page.parts > 1 ? `${page.part}/${page.parts}` : '');
  dom.grid.style.setProperty('--cols', String(m.layout.cols));
  dom.grid.style.setProperty('--tile-h', `${m.layout.tileH}px`);
  dom.grid.style.setProperty('--gap', `${m.layout.gap}px`);
  const seenTiles = new Set<string>();
  const tiles = keep(dom.tiles, page?.rooms ?? [], () => makeTile(doc), (tile, e) => renderTile(tile, e, t, format), seenTiles);
  syncChildren(dom.grid, tiles);
  for (const id of [...dom.tiles.keys()]) if (!seenTiles.has(id)) dom.tiles.delete(id);

  // Attention: the whole school, whatever is on screen.
  const att = attention(m.entries);
  const view = fitAttention(att, m.layout.lines);
  const seenLines = new Set<string>();
  const line = (item: Line, e: RoomEntry) => {
    item.li.dataset.air = e.air ?? 'off';
    setText(item.id, displayRoomId(e.room));
    setCo2(item.value, null, e.co2, format, t.unknown);
    item.li.dataset.source = e.simulated ? 'simulated' : 'sensor';
  };
  syncChildren(dom.badList, keep(dom.lines, view.bad, () => makeLine(doc), line, seenLines));
  syncChildren(dom.soonList, keep(dom.lines, view.soon, () => makeLine(doc), line, seenLines));
  for (const id of [...dom.lines.keys()]) if (!seenLines.has(id)) dom.lines.delete(id);
  setText(dom.badName, t.kioskBad);
  setText(dom.badCount, String(att.bad.length));
  setText(dom.soonName, t.kioskSoon);
  setText(dom.soonCount, String(att.soon.length));
  dom.bad.hidden = view.bad.length === 0;
  dom.soon.hidden = view.soon.length === 0;
  setText(dom.more, view.more > 0 ? t.kioskMore(view.more) : '');
  dom.more.hidden = view.more === 0;
  const none = att.bad.length + att.soon.length === 0 && !empty;
  setText(dom.good, none ? t.kioskAllGood : '');
  dom.good.hidden = !none;

  // Footer: the floors as words, the current one marked, a progress line over the page time.
  setAttr(dom.floors, 'aria-label', t.kioskFloors);
  const wanted = m.floors.map((f) => {
    const k = floorKey(f);
    let li = dom.footer.get(k);
    if (!li) {
      li = doc.createElement('li');
      dom.footer.set(k, li);
    }
    const current = page !== null && floorKey(page.floor) === k;
    li.dataset.current = String(current);
    if (current) li.setAttribute('aria-current', 'true');
    else li.removeAttribute('aria-current');
    // The word is a text node so that the progress line, a child, is not touched by a redraw.
    const word = li.firstChild?.nodeType === 3 ? (li.firstChild as Text) : null;
    const label = t.floorName(f);
    if (word) {
      if (word.data !== label) word.data = label;
    } else li.prepend(doc.createTextNode(label));
    return li;
  });
  syncChildren(dom.floors, wanted);
  const present = new Set<string>(m.floors.map(floorKey));
  for (const k of [...dom.footer.keys()]) if (!present.has(k)) dom.footer.delete(k);

  const running = m.pageCount > 1 && page !== null;
  const pageKey = key(page);
  if (!running) {
    dom.progress?.remove();
    dom.progress = null;
    dom.progressKey = '';
  } else if (dom.progress === null || dom.progressKey !== pageKey) {
    // A new page: a new element restarts the CSS animation.
    dom.progress?.remove();
    dom.progress = span(doc, 'k-prog');
    dom.progress.setAttribute('aria-hidden', 'true');
    dom.progressKey = pageKey;
  }
  if (running && dom.progress) {
    dom.root.style.setProperty('--page-s', `${m.seconds}s`);
    const current = dom.footer.get(floorKey(page.floor));
    if (current && dom.progress.parentElement !== current) current.append(dom.progress);
  }

  const anySimulated = m.entries.some((g) => g.rooms.some((r) => r.simulated));
  setText(dom.legend, anySimulated ? t.listLegend : '');
  dom.legend.hidden = !anySimulated;
}
