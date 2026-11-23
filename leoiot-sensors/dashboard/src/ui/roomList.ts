// The room list and the room choice in the header. Both are updated in place: one <li> per room is
// kept and only text and attributes change, so that a link with keyboard focus keeps it while the
// list is redrawn every few seconds. Elements are inserted, removed or moved only when the set of
// rooms changes. Text is only ever set as text, never as HTML, because room ids come from topics.
import type { Format } from '../core/format';
import { texts, type Lang } from '../core/i18n';
import { groupByFloor, type FloorId } from '../core/floors';
import { displayRoomId } from '../core/room';
import { summarise, type FloorEntries, type RoomEntry } from '../core/roomList';
import type { FeedMode } from '../data/feed';
import { setText } from './render';

export interface RoomListDom {
  doc: Document;
  section: HTMLElement;
  title: HTMLElement;
  summary: HTMLElement;
  fresh: HTMLElement;
  freshText: HTMLElement;
  legend: HTMLElement;
  msg: HTMLElement;
  body: HTMLElement;
  select: HTMLSelectElement;
  items: Map<string, RoomItem>;
  groups: Map<string, FloorBlock>;
  /** What the select was built from, so that it is rebuilt only when the rooms or the language change. */
  choiceKey: string;
}

interface RoomItem {
  li: HTMLLIElement;
  link: HTMLAnchorElement;
  id: HTMLElement;
  state: HTMLElement;
  value: HTMLElement;
  unit: HTMLElement;
}

interface FloorBlock {
  section: HTMLElement;
  heading: HTMLElement;
  name: HTMLElement;
  counts: HTMLElement;
  list: HTMLUListElement;
}

export function bindRoomListDom(doc: Document): RoomListDom {
  const el = (id: string): HTMLElement => {
    const found = doc.getElementById(id);
    if (!found) throw new Error(`missing element #${id}`);
    return found;
  };
  return {
    doc,
    section: el('rooms'), title: el('roomsTitle'), summary: el('roomsSummary'), fresh: el('roomsFresh'), freshText: el('roomsFreshText'), legend: el('roomsLegend'),
    msg: el('roomsMsg'), body: el('roomsBody'),
    select: el('roomSelect') as HTMLSelectElement,
    items: new Map(), groups: new Map(), choiceKey: '',
  };
}

function setAttr(el: Element, name: string, value: string): void {
  if (el.getAttribute(name) !== value) el.setAttribute(name, value);
}

/** Makes the children of `parent` exactly `wanted`, moving only what is out of place. */
function syncChildren(parent: Element, wanted: Element[]): void {
  wanted.forEach((child, i) => {
    if (parent.children[i] !== child) parent.insertBefore(child, parent.children[i] ?? null);
  });
  while (parent.children.length > wanted.length) parent.lastElementChild?.remove();
}

function span(doc: Document, className: string): HTMLElement {
  const e = doc.createElement('span');
  e.className = className;
  return e;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

/** The 12px warning triangle of an outdated room (the paths of the room page's #warnIcon). */
function warnIcon(doc: Document): SVGElement {
  const svg = doc.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'rwarn');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  for (const d of ['M12 3.5 2.5 20h19L12 3.5z', 'M12 10v4.5', 'M12 17.5h.01']) {
    const path = doc.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', d);
    svg.append(path);
  }
  return svg;
}

function makeItem(doc: Document): RoomItem {
  const li = doc.createElement('li');
  const link = doc.createElement('a');
  const lamp = span(doc, 'lamp-dot');
  lamp.setAttribute('aria-hidden', 'true');
  const main = span(doc, 'rmain');
  const id = span(doc, 'rid');
  const state = span(doc, 'rstate');
  main.append(id, state);
  const co2 = span(doc, 'rco2');
  const value = span(doc, 'v');
  const unit = span(doc, 'u');
  co2.append(value, unit);
  link.append(lamp, warnIcon(doc), main, co2);
  li.append(link);
  return { li, link, id, state, value, unit };
}

export interface ListModel {
  entries: FloorEntries[];
  /** False until the first answer (message, stored readings or a short wait) is in. */
  ready: boolean;
  feed: FeedMode;
  /** The last load of the stored readings failed. */
  failed: boolean;
  /** Time of the last successful load of the stored readings. */
  lastLoadAt: number | null;
  lang: Lang;
}

type T = ReturnType<typeof texts>;

function airText(e: RoomEntry, t: T): string {
  if (e.air === null) return t.listNoCo2;
  return e.air === 'good' ? t.statusGood : e.air === 'soon' ? t.statusSoon : t.statusBad;
}

/** The word shown after the id: only for rooms that need attention, no CO₂ value or outdated values. */
function stateText(e: RoomEntry, t: T, format: Format): string {
  return e.state === 'stale' ? t.freshStale(format.time(e.lastAt)) : airText(e, t);
}

/** What a screen reader says for the link: the visible id first, then state, value and source. */
function linkLabel(e: RoomEntry, t: T, format: Format): string {
  const parts = [displayRoomId(e.room), stateText(e, t, format), e.co2 === null ? t.unknown : `${format.number(e.co2, 0)} ppm`];
  if (e.simulated) parts.push(t.simulated);
  return parts.join(', ');
}

/** The room list: floors with their rooms, or the "no room is sending" text. */
export function renderRoomList(dom: RoomListDom, m: ListModel, format: Format): void {
  const t = texts(m.lang);
  setText(dom.title, t.roomsTitle);
  const empty = m.entries.length === 0;
  const msg = !m.ready ? t.statusLoading : empty ? (m.failed ? t.listLoadError : t.noRooms) : '';
  setText(dom.msg, msg);
  dom.msg.hidden = msg === '';

  const summary = summarise(m.entries);
  setText(dom.summary, empty ? '' : t.listCounts(summary.total));
  dom.summary.hidden = empty;
  const freshText = m.feed === 'live' ? t.listLive : m.feed === 'fallback' ? t.listFallbackAt(m.lastLoadAt === null ? null : format.time(m.lastLoadAt)) : '';
  setText(dom.freshText, freshText);
  dom.fresh.hidden = freshText === '';
  const anySimulated = m.entries.some((g) => g.rooms.some((r) => r.simulated));
  setText(dom.legend, anySimulated ? t.listLegend : '');
  dom.legend.hidden = !anySimulated;

  const seen = new Set<string>();
  const blocks: HTMLElement[] = [];
  for (const group of m.entries) {
    const key = group.floor ?? '-';
    let block = dom.groups.get(key);
    if (!block) {
      const section = dom.doc.createElement('section');
      section.className = 'floor';
      const heading = dom.doc.createElement('h3');
      const name = dom.doc.createElement('span');
      const counts = span(dom.doc, 'fcount');
      heading.append(name, counts);
      const list = dom.doc.createElement('ul');
      section.append(heading, list);
      block = { section, heading, name, counts, list };
      dom.groups.set(key, block);
    }
    setText(block.name, t.floorName(group.floor));
    const floorCounts = summary.floors[m.entries.indexOf(group)].counts;
    setText(block.counts, ` · ${t.listCounts(floorCounts)}`);
    const items: HTMLElement[] = [];
    for (const e of group.rooms) {
      seen.add(e.room);
      let item = dom.items.get(e.room);
      if (!item) {
        item = makeItem(dom.doc);
        dom.items.set(e.room, item);
      }
      item.li.dataset.air = e.state === 'stale' ? 'off' : e.air ?? 'off';
      item.li.dataset.fresh = e.state;
      item.li.dataset.source = e.simulated ? 'simulated' : 'sensor';
      setAttr(item.link, 'href', `?room=${encodeURIComponent(e.room)}`);
      setText(item.id, displayRoomId(e.room));
      setAttr(item.link, 'aria-label', linkLabel(e, t, format));
      setText(item.state, stateText(e, t, format));
      item.state.className = e.state === 'live' && e.air === 'good' ? 'rstate sr-only' : 'rstate';
      setText(item.value, e.co2 === null ? t.unknown : format.number(e.co2, 0));
      setText(item.unit, e.co2 === null ? '' : 'ppm');
      items.push(item.li);
    }
    syncChildren(block.list, items);
    blocks.push(block.section);
  }
  for (const id of [...dom.items.keys()]) if (!seen.has(id)) dom.items.delete(id);
  const wanted = new Set<string>(m.entries.map((g) => g.floor ?? '-'));
  for (const key of [...dom.groups.keys()]) if (!wanted.has(key)) dom.groups.delete(key);
  syncChildren(dom.body, blocks);
}

/** The room choice in the header: floors as groups, the shown room selected even when it has no data. */
export function renderRoomChoice(dom: RoomListDom, rooms: readonly string[], shown: string | null, lang: Lang): void {
  const t = texts(lang);
  const ids = shown !== null && !rooms.includes(shown) ? [...rooms, shown] : [...rooms];
  const groups = groupByFloor(ids);
  const key = `${lang}|${groups.map((g) => `${g.floor}:${g.rooms.join(',')}`).join(';')}`;
  if (key !== dom.choiceKey) {
    dom.choiceKey = key;
    const optgroups = groups.map((g) => {
      const og = dom.doc.createElement('optgroup');
      og.label = t.floorName(g.floor as FloorId | null);
      for (const id of g.rooms) {
        const o = dom.doc.createElement('option');
        o.value = id;
        o.textContent = displayRoomId(id);
        og.append(o);
      }
      return og;
    });
    dom.select.replaceChildren(...optgroups);
  }
  if (shown !== null && dom.select.value !== shown) dom.select.value = shown;
}
