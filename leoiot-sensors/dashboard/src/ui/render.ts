// Draws the page from the views. The markup is in index.html; everything here sets text and
// attributes in place (values change without moving other content). Text is only ever set as text,
// never as HTML, because the room id comes from the address.
import type { ChartInput } from '../core/chartOptions';
import { makeFormat, type Format } from '../core/format';
import { texts, type Lang } from '../core/i18n';
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
  brand: HTMLElement;
  brandSub: HTMLElement;
  rangeGroup: HTMLElement;
  langGroup: HTMLElement;
  theme: HTMLElement;
  roomWord: HTMLElement;
  roomId: HTMLElement;
  ident: HTMLElement;
  light: HTMLElement;
  status: HTMLElement;
  why: HTMLElement;
  fresh: HTMLElement;
  warn: HTMLElement;
  cells: Record<Quantity, { value: HTMLElement; unknown: HTMLElement; label: HTMLElement }>;
  hTemp: HTMLElement;
  hAir: HTMLElement;
  winA: HTMLElement;
  winB: HTMLElement;
  chartTemp: HTMLElement;
  chartAir: HTMLElement;
  noteA: HTMLElement;
  noteB: HTMLElement;
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
    app: el('app'), crumb: el('crumb'), brand: el('brand'), brandSub: el('brandSub'),
    rangeGroup: el('rangeGroup'), langGroup: el('langGroup'), theme: el('theme'),
    roomWord: el('roomWord'), roomId: el('roomId'), ident: el('ident'), light: el('light'),
    status: el('status'), why: el('why'), fresh: el('fresh'), warn: el('warnIcon'),
    cells: { co2: cell('Co2'), temperature: cell('Temp'), humidity: cell('Hum') },
    hTemp: el('hTemp'), hAir: el('hAir'), winA: el('winA'), winB: el('winB'),
    chartTemp: el('chartTemp'), chartAir: el('chartAir'), noteA: el('noteA'), noteB: el('noteB'),
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
  room: RoomChoice;
  range: RangeId;
  /** The theme in effect, for the label of the theme button. */
  theme: Theme;
}

/** Labels that depend on language, room, range and theme only. */
export function renderFrame(dom: Dom, f: Frame): void {
  const t = texts(f.lang);
  const shown = displayRoomId(f.room.id);
  dom.doc.documentElement.lang = f.lang;
  dom.doc.title = t.title(shown);
  setText(dom.brand, t.brand);
  setText(dom.brandSub, t.brandSub);
  setText(dom.crumb, t.room(shown));
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
  setText(dom.hTemp, t.temperature);
  setText(dom.hAir, t.co2Humidity);
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

  // Identity line: device names and where the readings come from.
  const names = view.devices.join(', ');
  const device = names === '' ? '' : simulated ? t.deviceOther(names) : t.deviceSensor(names);
  const origin = view.source === null ? '' : simulated ? t.simulated : t.measured;
  const identKey = `${device}|${origin}`;
  if (dom.ident.dataset.key !== identKey) {
    dom.ident.dataset.key = identKey;
    dom.ident.replaceChildren();
    const parts = [device ? ['', device] : null, device && origin ? ['sep', '·'] : null, origin ? ['tag', origin] : null];
    for (const p of parts) {
      if (!p) continue;
      const span = dom.doc.createElement('span');
      if (p[0]) span.className = p[0];
      if (p[0] === 'sep') span.setAttribute('aria-hidden', 'true');
      span.textContent = p[1];
      dom.ident.append(span);
    }
  }

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

/** Window texts above the charts, the notes below them and the accessible names of the charts. */
export function renderChartFrame(dom: Dom, f: { lang: Lang; range: RangeId; now: number; history: HistoryStatus; empty: boolean }): void {
  const t = texts(f.lang);
  const format = makeFormat(f.lang);
  const { start, end } = rangeBounds(f.range, f.now);
  const win = format.window(start, end);
  setText(dom.winA, `${win} · °C`);
  setText(dom.winB, win);
  const note = f.history === 'error' ? t.historyError : f.history === 'loading' ? t.historyLoading : f.empty ? t.historyEmpty : '';
  for (const n of [dom.noteA, dom.noteB]) {
    setText(n, note);
    n.hidden = note === '';
  }
  setAttr(dom.chartTemp, 'aria-label', `${t.temperature}, ${win}`);
  setAttr(dom.chartAir, 'aria-label', `${t.co2Humidity}, ${win}`);
}

/** What the chart builders need beyond the points. */
export function chartInput(base: Omit<ChartInput, 'format'>): ChartInput {
  return { ...base, format: makeFormat(base.lang) };
}
