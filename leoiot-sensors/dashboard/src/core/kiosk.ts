// The hallway display's logic: which rooms fit on a page, which page comes next, which rooms need
// attention, what the address asks for, and when the nightly reload is due. No DOM here.
import { zoneOffset } from './format';
import type { FloorId } from './floors';
import { compareRoomIds } from './floors';
import { DEFAULT_LANG, isLang, type Lang } from './i18n';
import { floorFromParam, type FloorEntries, type FloorFilter, type RoomEntry } from './roomList';

export type KioskTheme = 'dark' | 'light';

export interface KioskParams {
  floor: FloorFilter;
  lang: Lang;
  theme: KioskTheme;
  /** Page time in seconds. */
  seconds: number;
}

export const DEFAULT_SECONDS = 15;
export const MIN_SECONDS = 5;
export const MAX_SECONDS = 120;

/** True when the address asks for the hallway display: `kiosk` in the query, with or without a value. */
export const isKioskSearch = (search: string): boolean => new URLSearchParams(search).has('kiosk');

/** The options of the address: `floor`, `lang` (de, en), `theme` (dark, light) and `seconds` (5 to 120). Unknown values mean the default. */
export function kioskParams(search: string): KioskParams {
  const p = new URLSearchParams(search);
  const lang = p.get('lang');
  const raw = p.get('seconds');
  const n = raw === null || raw.trim() === '' ? NaN : Number(raw);
  return {
    floor: floorFromParam(p.get('floor')),
    lang: isLang(lang) ? lang : DEFAULT_LANG,
    theme: p.get('theme') === 'light' ? 'light' : 'dark',
    seconds: Number.isFinite(n) ? Math.min(MAX_SECONDS, Math.max(MIN_SECONDS, Math.round(n))) : DEFAULT_SECONDS,
  };
}

/** The smallest tile at 1920 x 1080; everything scales with `scale` (1 at that size). */
export const TILE_MIN_WIDTH = 220;
export const TILE_MIN_HEIGHT = 120;

/** Columns and rows of tiles that fit an area (in px), with `gap` px between tiles; at least one of each. */
export function tileGrid(width: number, height: number, scale = 1, gap = 0): { cols: number; rows: number } {
  const fit = (size: number, min: number) => Math.max(1, Math.floor((size + gap) / (min * scale + gap)));
  return { cols: fit(width, TILE_MIN_WIDTH), rows: fit(height, TILE_MIN_HEIGHT) };
}

export interface KioskPage {
  floor: FloorId | null;
  /** 1-based part of the floor. */
  part: number;
  parts: number;
  rooms: RoomEntry[];
}

/** One page per floor, in the order given; a floor with more than `perPage` rooms is split into `ceil(n / perPage)` near-equal parts. */
export function kioskPages(entries: readonly FloorEntries[], perPage: number): KioskPage[] {
  const size = Math.max(1, Math.floor(perPage));
  const pages: KioskPage[] = [];
  for (const g of entries) {
    const n = g.rooms.length;
    if (n === 0) continue;
    const parts = Math.ceil(n / size);
    const base = Math.floor(n / parts);
    const extra = n % parts; // the first parts take one room more
    let at = 0;
    for (let part = 1; part <= parts; part++) {
      const count = base + (part <= extra ? 1 : 0);
      pages.push({ floor: g.floor, part, parts, rooms: g.rooms.slice(at, at + count) });
      at += count;
    }
  }
  return pages;
}

export interface Attention {
  /** "Jetzt lüften", highest CO₂ first. */
  bad: RoomEntry[];
  /** "Bald lüften", highest CO₂ first. */
  soon: RoomEntry[];
}

/** The live rooms that need airing, from the whole school; outdated rooms and rooms without a CO₂ value are left out. */
export function attention(entries: readonly FloorEntries[]): Attention {
  const rooms = entries.flatMap((g) => g.rooms).filter((r) => r.state === 'live' && r.co2 !== null);
  const byCo2 = (a: RoomEntry, b: RoomEntry) => (b.co2 as number) - (a.co2 as number) || compareRoomIds(a.room, b.room);
  return {
    bad: rooms.filter((r) => r.air === 'bad').sort(byCo2),
    soon: rooms.filter((r) => r.air === 'soon').sort(byCo2),
  };
}

export interface AttentionView {
  bad: RoomEntry[];
  soon: RoomEntry[];
  /** Rooms that did not fit ("+ 4 weitere"). */
  more: number;
}

/**
 * What fits into `lines` lines of equal height. A group heading takes a line, so does the "+ N more"
 * line; rooms are taken in order (bad first) and a group without a room left gets no heading.
 */
export function fitAttention(a: Attention, lines: number): AttentionView {
  const total = a.bad.length + a.soon.length;
  const headings = (a.bad.length > 0 ? 1 : 0) + (a.soon.length > 0 ? 1 : 0);
  if (total + headings <= lines) return { bad: a.bad, soon: a.soon, more: 0 };
  let left = Math.max(0, lines - 1);
  const take = (rooms: RoomEntry[]): RoomEntry[] => {
    if (rooms.length === 0 || left < 2) return [];
    const n = Math.min(rooms.length, left - 1);
    left -= n + 1;
    return rooms.slice(0, n);
  };
  const bad = take(a.bad);
  const soon = take(a.soon);
  return { bad, soon, more: total - bad.length - soon.length };
}

export const RELOAD_HOUR = 3;
export const RELOAD_MINUTE = 30;

/** The next 03:30 in the school's time (Europe/Vienna) after `now`, as an instant. */
export function nextReloadAt(now: number): number {
  const local = new Date(now + zoneOffset(now));
  for (let day = 0; day <= 2; day++) {
    const wall = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + day, RELOAD_HOUR, RELOAD_MINUTE);
    let at = wall - zoneOffset(wall);
    at = wall - zoneOffset(at); // the offset at the target can differ from the one at the first guess
    if (at > now) return at;
  }
  return now + 24 * 3600_000;
}
