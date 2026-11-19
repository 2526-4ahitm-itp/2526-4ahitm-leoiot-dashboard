// Draws the page from the views. The markup is in index.html; everything here sets text and
// attributes in place (values change without moving other content). Text is only ever set as text,
// never as HTML, because the room id comes from the address.
import type { ChartInput } from '../core/chartOptions';
import { makeFormat, type Format } from '../core/format';
import { texts, type Lang } from '../core/i18n';
import { floorOf } from '../core/floors';
import { displayRoomId, type RoomChoice } from '../core/room';
import { rangeBounds, type RangeId } from '../core/ranges';
import type { Quantity } from '../core/snapshot';
import type { RoomView } from '../core/view';
import type { FeedMode } from '../data/feed';
import type { Theme } from './prefs';

export type HistoryStatus = 'loading' | 'error' | 'ok';

export interface Dom {
  doc: Document;
  app: HTMLElement;
  crumb: HTMLElement;
  allRooms: HTMLElement;
  roomSelect: HTMLSelectElement;
  link3d: HTMLElement;
  brand: HTMLElement;
  brandSub: HTMLElement;
  rangeGroup: HTMLElement;
  langGroup: HTMLElement;
  theme: HTMLElement;
  roomWord: HTMLElement;
  roomId: HTMLElement;
  simTag: HTMLElement;
  light: HTMLElement;
  status: HTMLElement;
  why: HTMLElement;
  fresh: HTMLElement;
  warn: HTMLElement;
  cells: Record<Quantity, { value: HTMLElement; unknown: HTMLElement; label: HTMLElement }>;
  /** Temperature and humidity: the cell (carries the lamp state) and the line for the direction word. */
  small: Record<'temperature' | 'humidity', { cell: HTMLElement; dir: HTMLElement }>;
  today: {
    title: HTMLElement; empty: HTMLElement; list: HTMLElement;
    kAbove: HTMLElement; vAbove: HTMLElement; kPeak: HTMLElement; vPeak: HTMLElement; uPeak: HTMLElement;
    kAired: HTMLElement; vAired: HTMLElement; airedNote: HTMLElement;
  };
  hCo2: HTMLElement;
  hTemp: HTMLElement;
  hHum: HTMLElement;
  winCo2: HTMLElement;
  winTemp: HTMLElement;
  winHum: HTMLElement;
  chartCo2: HTMLElement;
  chartTemp: HTMLElement;
  chartHum: HTMLElement;
  noteCo2: HTMLElement;
  noteTemp: HTMLElement;
  noteHum: HTMLElement;
  empty: HTMLElement;
  emptyTitle: HTMLElement;
  emptyText: HTMLElement;
}

export function bindDom(doc: Document): Dom {
  const el = (id: string): HTMLElement => {
    const found = doc.getElementById(id);
    if (!found) throw new Error(`missing element #${id}`);
    return found;
  };
  const cell = (q: string) => ({ value: el(`v${q}`), unknown: el(`u${q}`), label: el(`k${q}`) });
  return {
    doc,
    app: el('app'), crumb: el('crumb'), allRooms: el('allRooms'), roomSelect: el('roomSelect') as HTMLSelectElement, link3d: el('link3d'), brand: el('brand'), brandSub: el('brandSub'),
    rangeGroup: el('rangeGroup'), langGroup: el('langGroup'), theme: el('theme'),
    roomWord: el('roomWord'), roomId: el('roomId'), simTag: el('simTag'), light: el('light'),
    status: el('status'), why: el('why'), fresh: el('fresh'), warn: el('warnIcon'),
    cells: { co2: cell('Co2'), temperature: cell('Temp'), humidity: cell('Hum') },
    small: { temperature: { cell: el('cellTemp'), dir: el('dTemp') }, humidity: { cell: el('cellHum'), dir: el('dHum') } },
    today: {
      title: el('todayTitle'), empty: el('todayEmpty'), list: el('todayList'),
      kAbove: el('kAbove'), vAbove: el('vAbove'), kPeak: el('kPeak'), vPeak: el('vPeak'), uPeak: el('uPeak'),
      kAired: el('kAired'), vAired: el('vAired'), airedNote: el('airedNote'),
    },
    hCo2: el('hCo2'), hTemp: el('hTemp'), hHum: el('hHum'),
    winCo2: el('winCo2'), winTemp: el('winTemp'), winHum: el('winHum'),
    chartCo2: el('chartCo2'), chartTemp: el('chartTemp'), chartHum: el('chartHum'),
    noteCo2: el('noteCo2'), noteTemp: el('noteTemp'), noteHum: el('noteHum'),
    empty: el('empty'), emptyTitle: el('emptyTitle'), emptyText: el('emptyText'),
  };
}

/** Sets text only when it differs: an unchanged text node must not trigger the live region again. */
export function setText(el: HTMLElement, text: string): void {
  if (el.textContent !== text) el.textContent = text;
}

function setAttr(el: Element, name: string, value: string): void {
  if (el.getAttribute(name) !== value) el.setAttribute(name, value);
}

export interface Frame {
  lang: Lang;
  /** The room page's room; null on the room list view. */
  room: RoomChoice | null;
  range: RangeId;
  /** The theme in effect, for the label of the theme button. */
  theme: Theme;
}

/** Labels that depend on language, room, range and theme only. */
export function renderFrame(dom: Dom, f: Frame): void {
  const t = texts(f.lang);
  const shown = f.room === null ? '' : displayRoomId(f.room.id);
  dom.doc.documentElement.lang = f.lang;
  dom.doc.title = f.room === null ? t.titleList : t.title(shown);
  dom.app.dataset.view = f.room === null ? 'list' : 'room';
  setText(dom.brand, t.brand);
  setText(dom.brandSub, t.brandSub);
  // Room navigation: "Alle Räume" is the current page on the list (no link), a link on a room page.
  setAttr(dom.crumb, 'aria-label', t.nav);
  setText(dom.allRooms, t.allRooms);
  if (f.room === null) {
    dom.allRooms.removeAttribute('href');
    setAttr(dom.allRooms, 'aria-current', 'page');
  } else {
    setAttr(dom.allRooms, 'href', './');
    dom.allRooms.removeAttribute('aria-current');
  }
  setAttr(dom.roomSelect, 'aria-label', t.roomChoice);
  dom.roomSelect.hidden = f.room === null;
  dom.rangeGroup.hidden = f.room === null;
  // The link to the room in the 3D explorer (the host's /3d/, not relative to /sensors/), only for rooms of a known floor.
  setText(dom.link3d, t.show3d);
  if (f.room !== null) setAttr(dom.link3d, 'href', `/3d/?room=${encodeURIComponent(f.room.id)}`);
  dom.link3d.hidden = f.room === null || !f.room.valid || floorOf(f.room.id) === null;
  setText(dom.roomWord, `${t.roomLabel} `);
  setText(dom.roomId, shown);
  setAttr(dom.rangeGroup, 'aria-label', t.range);
  setAttr(dom.langGroup, 'aria-label', t.language);
  for (const b of dom.rangeGroup.querySelectorAll<HTMLElement>('[data-range]')) {
    const id = b.dataset.range as RangeId;
    setText(b, id === '24h' ? t.range24h : t.range7d);
    setAttr(b, 'aria-pressed', String(id === f.range));
  }
  for (const b of dom.langGroup.querySelectorAll<HTMLElement>('[data-lang]')) setAttr(b, 'aria-pressed', String(b.dataset.lang === f.lang));
  setAttr(dom.theme, 'aria-label', f.theme === 'dark' ? t.themeToLight : t.themeToDark);
  setText(dom.cells.co2.label, t.co2);
  setText(dom.cells.temperature.label, t.temperature);
  setText(dom.cells.humidity.label, t.humidity);
  setText(dom.today.title, t.todayTitle);
  setText(dom.today.kAbove, t.aboveLabel);
  setText(dom.today.kPeak, t.peakLabel);
  setText(dom.today.kAired, t.airedLabel);
  setText(dom.hCo2, t.co2);
  setText(dom.hTemp, t.temperature);
  setText(dom.hHum, t.humidity);
  setAttr(dom.warn, 'aria-label', t.warning);
}

const DECIMALS: Record<Quantity, number> = { co2: 0, temperature: 1, humidity: 0 };

export interface RoomContext {
  lang: Lang;
  room: RoomChoice;
  now: number;
  feed: FeedMode;
}

/** The room panel and the "no data" / "error" panel for one view. */
export function renderRoom(dom: Dom, view: RoomView, c: RoomContext, format: Format = makeFormat(c.lang)): void {
  const t = texts(c.lang);
  const simulated = view.source === 'simulated';
  dom.app.dataset.state = view.state;
  dom.app.dataset.air = view.air ?? 'off';
  dom.app.dataset.fresh = view.state === 'stale' ? 'stale' : 'live';
  dom.app.dataset.source = view.source ?? 'sensor';

  setAttr(dom.light, 'aria-label', view.air === 'good' ? t.lampGood : view.air === 'soon' ? t.lampSoon : view.air === 'bad' ? t.lampBad : t.lampOff);

  // Identity line: the room (set by renderFrame), the link, and the pill for simulated readings only.
  setText(dom.simTag, simulated ? t.simulated : '');
  dom.simTag.hidden = !simulated;

  // Status sentence and its reason.
  let status = '';
  let why = '';
  const lastAt = view.lastAt ?? 0;
  if (view.state === 'loading') {
    status = t.statusLoading;
    why = t.whyLoading;
  } else if (view.state === 'stale') {
    status = t.statusStale;
    why = t.whyStale(format.time(lastAt), format.agoLong(view.ageMs ?? 0), simulated);
  } else if (view.state === 'live') {
    if (view.air === null) {
      status = t.statusNoCo2;
      why = t.whyNoCo2;
    } else if (view.air === 'good') {
      status = t.statusGood;
      why = t.whyGood;
    } else {
      const since = { time: format.time(view.since?.at ?? lastAt), long: view.since?.beforeRange ?? false };
      status = view.air === 'soon' ? t.statusSoon : t.statusBad;
      why = view.air === 'soon' ? t.whySoon(since) : t.whyBad(since);
    }
  }
  setText(dom.status, status);
  setText(dom.why, why);

  // Values: an unknown quantity is a dash, never zero.
  for (const q of ['co2', 'temperature', 'humidity'] as const) {
    const v = view.values[q];
    setText(dom.cells[q].value, v === null ? t.unknown : format.number(v, DECIMALS[q]));
    setText(dom.cells[q].unknown, v === null ? t.unknownValue : '');
  }

  // Small lamps: the state is the dot's colour, the value's ink colour and the word below the value.
  const words = { low: [t.tooCold, t.tooDry], high: [t.tooWarm, t.tooHumid], ok: [t.inRange, t.inRange] } as const;
  for (const [q, i] of [['temperature', 0], ['humidity', 1]] as const) {
    const c = view.comfort[q];
    setAttr(dom.small[q].cell, 'data-lamp', c.lamp);
    setText(dom.small[q].dir, c.direction === null ? '' : words[c.direction][i]);
  }

  renderToday(dom, view, t, format);

  // Age line.
  let fresh = '';
  if (view.state === 'stale') fresh = t.freshStale(format.time(lastAt));
  else if (view.state === 'live') {
    fresh = t.fresh(format.time(lastAt, true), format.ageShort(view.ageMs ?? 0)) + (c.feed === 'fallback' ? t.freshFallback : '');
  }
  setText(dom.fresh, fresh);

  // Rooms without data, and load errors.
  const shown = displayRoomId(c.room.id);
  if (view.state === 'error') {
    setText(dom.emptyTitle, t.loadErrorTitle);
    setText(dom.emptyText, t.loadErrorText);
  } else {
    setText(dom.emptyTitle, t.noDataTitle(shown));
    setText(dom.emptyText, c.room.valid ? t.noDataText : t.invalidRoomText);
  }
}

/** The summary of the day; the layout keeps its place whatever it shows. */
function renderToday(dom: Dom, view: RoomView, t: ReturnType<typeof texts>, format: Format): void {
  const d = dom.today;
  const td = view.today;
  const none = td !== null && td.empty;
  setText(d.empty, none ? t.todayEmpty : '');
  d.empty.hidden = !none;
  d.list.hidden = none;
  if (none) return;
  setText(d.vAbove, td === null ? t.unknown : td.aboveMinutes === 0 ? t.aboveNone : format.ageShort(td.aboveMinutes * 60_000));
  setText(d.vPeak, td?.peak ? format.number(td.peak.value, 0) : t.unknown);
  setText(d.uPeak, td?.peak ? `ppm · ${format.time(td.peak.at)}` : '');
  setText(d.vAired, td === null ? t.unknown : td.airedAt === null ? t.airedNone : t.airedAt(format.time(td.airedAt)));
  setText(d.airedNote, td !== null && td.airedAt !== null ? t.airedNote : '');
}

/** Window texts above the charts, the notes below them and the accessible names of the charts. */
export function renderChartFrame(dom: Dom, f: { lang: Lang; range: RangeId; now: number; history: HistoryStatus; empty: boolean }): void {
  const t = texts(f.lang);
  const format = makeFormat(f.lang);
  const { start, end } = rangeBounds(f.range, f.now);
  const win = format.window(start, end);
  setText(dom.winCo2, `${win} · ppm`);
  setText(dom.winTemp, `${win} · °C`);
  setText(dom.winHum, `${win} · %`);
  const note = f.history === 'error' ? t.historyError : f.history === 'loading' ? t.historyLoading : f.empty ? t.historyEmpty : '';
  for (const n of [dom.noteCo2, dom.noteTemp, dom.noteHum]) {
    setText(n, note);
    n.hidden = note === '';
  }
  setAttr(dom.chartCo2, 'aria-label', `${t.co2}, ${win}`);
  setAttr(dom.chartTemp, 'aria-label', `${t.temperature}, ${win}`);
  setAttr(dom.chartHum, 'aria-label', `${t.humidity}, ${win}`);
}

/** What the chart builders need beyond the points. */
export function chartInput(base: Omit<ChartInput, 'format'>): ChartInput {
  return { ...base, format: makeFormat(base.lang) };
}
