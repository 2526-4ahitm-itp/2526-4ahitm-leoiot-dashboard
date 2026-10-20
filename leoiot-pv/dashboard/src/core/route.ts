// Ansicht und Zeitraum in der Adresse (?view=…&date=…), reine Datumsrechnung ohne Zeitzonen.
import { addDays } from '@leoiot-pv/shared/time';

export type View = 'day' | 'week' | 'month' | 'year';
/** key = erster Tag des Zeitraums, 'YYYY-MM-DD'. */
export interface Route {
  view: View;
  key: string;
}

const VIEWS: readonly View[] = ['day', 'week', 'month', 'year'];

const pad = (n: number): string => String(n).padStart(2, '0');

function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** Ist s ein echter Kalendertag 'YYYY-MM-DD'? */
export function isValidKey(s: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  return mo >= 1 && mo <= 12 && d >= 1 && d <= daysInMonth(y, mo);
}

// Montag = 0 … Sonntag = 6
function weekdayIndex(key: string): number {
  const [y, m, d] = key.split('-').map(Number);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

/** Erster Tag des Zeitraums, der den Tag key enthält. */
export function periodStart(view: View, key: string): string {
  switch (view) {
    case 'day':
      return key;
    case 'week':
      return addDays(key, -weekdayIndex(key));
    case 'month':
      return key.slice(0, 7) + '-01';
    case 'year':
      return key.slice(0, 4) + '-01-01';
  }
}

// Erster Tag des Folgezeitraums
function nextStart(view: View, start: string): string {
  const y = Number(start.slice(0, 4));
  const m = Number(start.slice(5, 7));
  switch (view) {
    case 'day':
      return addDays(start, 1);
    case 'week':
      return addDays(start, 7);
    case 'month':
      return m === 12 ? `${String(y + 1).padStart(4, '0')}-01-01` : `${start.slice(0, 5)}${pad(m + 1)}-01`;
    case 'year':
      return `${String(y + 1).padStart(4, '0')}-01-01`;
  }
}

// Erster Tag des Vorzeitraums
function prevStart(view: View, start: string): string {
  const y = Number(start.slice(0, 4));
  const m = Number(start.slice(5, 7));
  switch (view) {
    case 'day':
      return addDays(start, -1);
    case 'week':
      return addDays(start, -7);
    case 'month':
      return m === 1 ? `${String(y - 1).padStart(4, '0')}-12-01` : `${start.slice(0, 5)}${pad(m - 1)}-01`;
    case 'year':
      return `${String(y - 1).padStart(4, '0')}-01-01`;
  }
}

/** Alle Tagesschlüssel des Zeitraums, aufsteigend (Jahr: 365 oder 366). */
export function periodDays(view: View, key: string): string[] {
  const start = periodStart(view, key);
  const end = nextStart(view, start);
  const days: string[] = [];
  for (let d = start; d < end; d = addDays(d, 1)) days.push(d);
  return days;
}

const today = (todayKey: string): Route => ({ view: 'day', key: todayKey });

// Datum der Adresse als Tag: 'YYYY-MM-DD', 'YYYY-MM' (Monat) oder 'YYYY' (Jahr); sonst null
function dateOfAddress(raw: string): string | null {
  if (isValidKey(raw)) return raw;
  if (/^\d{4}-\d{2}$/.test(raw) && isValidKey(raw + '-01')) return raw + '-01';
  if (/^\d{4}$/.test(raw)) return raw + '-01-01';
  return null;
}

/** Route aus der Adresse; bei allem Unbekannten der Tag von heute. */
export function parseRoute(search: string, todayKey: string): Route {
  const params = new URLSearchParams(search);
  const rawView = params.get('view');
  const rawDate = params.get('date');
  if (rawView === null && rawDate === null) return today(todayKey);
  const view = (rawView ?? 'day') as View;
  if (!VIEWS.includes(view)) return today(todayKey);
  const day = rawDate === null ? todayKey : dateOfAddress(rawDate);
  if (day === null) return today(todayKey);
  const key = periodStart(view, day);
  return key > todayKey ? today(todayKey) : { view, key };
}

/** Adresse zur Route, z. B. '?view=month&date=2026-09'. */
export function routeSearch(r: Route): string {
  const date = r.view === 'month' ? r.key.slice(0, 7) : r.view === 'year' ? r.key.slice(0, 4) : r.key;
  return `?view=${r.view}&date=${date}`;
}

/** Nachbarzeitraum; null, wenn er nach heute liegt oder vor dem frühesten Wert endet. */
export function stepRoute(r: Route, dir: -1 | 1, todayKey: string, earliestKey: string | null): Route | null {
  const start = periodStart(r.view, r.key);
  const key = dir === 1 ? nextStart(r.view, start) : prevStart(r.view, start);
  if (dir === 1 && key > todayKey) return null;
  if (dir === -1 && earliestKey !== null && addDays(nextStart(r.view, key), -1) < earliestKey) return null;
  return { view: r.view, key };
}
