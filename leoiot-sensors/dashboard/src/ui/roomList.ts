// The room list and the room choice in the header. Both are updated in place: one <li> per room is
// kept and only text and attributes change, so that a link with keyboard focus keeps it while the
// list is redrawn every few seconds. Elements are inserted, removed or moved only when the set of
// rooms changes. Text is only ever set as text, never as HTML, because room ids come from topics.
import type { Format } from '../core/format';
import { texts, type Lang } from '../core/i18n';
import { groupByFloor, type FloorId } from '../core/floors';
import { displayRoomId } from '../core/room';
import type { FloorEntries, RoomEntry } from '../core/roomList';
import type { FeedMode } from '../data/feed';
import { setText } from './render';

export interface RoomListDom {
  doc: Document;
  section: HTMLElement;
  title: HTMLElement;
  note: HTMLElement;
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
  tag: HTMLElement;
}

interface FloorBlock {
  section: HTMLElement;
  heading: HTMLElement;
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
    section: el('rooms'), title: el('roomsTitle'), note: el('roomsNote'), msg: el('roomsMsg'), body: el('roomsBody'),
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

function makeItem(doc: Document): RoomItem {
  const li = doc.createElement('li');
  const link = doc.createElement('a');
  const lamp = span(doc, 'lamp-dot');
  lamp.setAttribute('aria-hidden', 'true');
  const id = span(doc, 'rid');
  const state = span(doc, 'rstate');
  const co2 = span(doc, 'rco2');
  const value = span(doc, 'v');
  const unit = span(doc, 'u');
  co2.append(value, unit);
  const tag = span(doc, 'rtag');
  link.append(lamp, id, state, co2, tag);
  li.append(link);
  return { li, link, id, state, value, unit, tag };
}

export interface ListModel {
  entries: FloorEntries[];
  /** False until the first answer (message, stored readings or a short wait) is in. */
  ready: boolean;
  feed: FeedMode;
  lang: Lang;
}

function stateText(e: RoomEntry, t: ReturnType<typeof texts>, format: Format): string {
  if (e.state === 'stale') return `${t.listStale} · ${format.time(e.lastAt)}`;
  if (e.air === null) return t.listNoCo2;
  return e.air === 'good' ? t.statusGood : e.air === 'soon' ? t.statusSoon : t.statusBad;
}

/** The room list: floors with their rooms, or the "no room is sending" text. */
export function renderRoomList(dom: RoomListDom, m: ListModel, format: Format): void {
  const t = texts(m.lang);
  setText(dom.title, t.roomsTitle);
  const empty = m.entries.length === 0;
  const msg = !m.ready ? t.statusLoading : empty ? t.noRooms : '';
  setText(dom.msg, msg);
  dom.msg.hidden = msg === '';
  setText(dom.note, t.listFallback);
  dom.note.hidden = m.feed !== 'fallback';

  const seen = new Set<string>();
  const blocks: HTMLElement[] = [];
  for (const group of m.entries) {
    const key = group.floor ?? '-';
    let block = dom.groups.get(key);
    if (!block) {
      const section = dom.doc.createElement('section');
      section.className = 'floor';
      const heading = dom.doc.createElement('h3');
      const list = dom.doc.createElement('ul');
      section.append(heading, list);
      block = { section, heading, list };
      dom.groups.set(key, block);
    }
    setText(block.heading, t.floorName(group.floor));
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
      setText(item.state, stateText(e, t, format));
      setText(item.value, e.co2 === null ? t.unknown : format.number(e.co2, 0));
      setText(item.unit, e.co2 === null ? '' : 'ppm');
      setText(item.tag, e.simulated ? t.simulated : '');
      item.tag.hidden = !e.simulated;
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
