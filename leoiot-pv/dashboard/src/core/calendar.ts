// Kalenderrechnung für die Datumsauswahl (reine Funktionen): Monatsmatrix mit ISO-Wochen, Monatsraster, Jahresliste, Tastenbewegung.
import { addDays } from '@leoiot-pv/shared/time';
import { isoWeek } from './lead';

export interface DayCell {
  key: string;
  day: number;
  inMonth: boolean;
  disabled: boolean;
}
export interface WeekRow {
  week: number;
  start: string;
  days: DayCell[];
}
export interface MonthCell {
  month: number; // 1..12
  key: string; // 'YYYY-MM-01'
  disabled: boolean;
}

const pad = (n: number, w = 2): string => String(n).padStart(w, '0');
const daysIn = (y: number, m: number): number => new Date(Date.UTC(y, m, 0)).getUTCDate();

/** Montag = 0 … Sonntag = 6. */
export function weekdayIndex(key: string): number {
  const [y, m, d] = key.split('-').map(Number);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

/** Liegt der Tag außerhalb von [min, max]? Fehlende Grenzen gelten nicht. */
export function dayDisabled(key: string, min: string | null, max: string | null): boolean {
  return (min !== null && key < min) || (max !== null && key > max);
}

/** Liegt der ganze Monat (Schlüssel 'YYYY-MM-…') außerhalb von [min, max]? */
export function monthDisabled(key: string, min: string | null, max: string | null): boolean {
  const ym = key.slice(0, 7);
  return (min !== null && ym < min.slice(0, 7)) || (max !== null && ym > max.slice(0, 7));
}

/** Monat als Wochenzeilen (Montag zuerst) mit ISO-Kalenderwoche; Tage außerhalb des Monats sind inMonth = false. */
export function monthMatrix(year: number, month: number, min: string | null, max: string | null): WeekRow[] {
  const first = `${pad(year, 4)}-${pad(month)}-01`;
  const last = `${pad(year, 4)}-${pad(month)}-${pad(daysIn(year, month))}`;
  const rows: WeekRow[] = [];
  for (let start = addDays(first, -weekdayIndex(first)); start <= last; start = addDays(start, 7)) {
    const days: DayCell[] = [];
    for (let i = 0; i < 7; i++) {
      const key = addDays(start, i);
      days.push({ key, day: Number(key.slice(8)), inMonth: key.slice(0, 7) === first.slice(0, 7), disabled: dayDisabled(key, min, max) });
    }
    rows.push({ week: isoWeek(start), start, days });
  }
  return rows;
}

/** Die zwölf Monate eines Jahres. */
export function monthGrid(year: number, min: string | null, max: string | null): MonthCell[] {
  return Array.from({ length: 12 }, (_, i) => {
    const key = `${pad(year, 4)}-${pad(i + 1)}-01`;
    return { month: i + 1, key, disabled: monthDisabled(key, min, max) };
  });
}

/** Jahre von min bis max aufsteigend; ohne min nur das Jahr von max. */
export function yearList(min: string | null, max: string): number[] {
  const to = Number(max.slice(0, 4));
  const from = min === null ? to : Math.min(Number(min.slice(0, 4)), to);
  return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}

/** Tag um n Monate verschoben; der Tag wird auf die Monatslänge gekürzt. */
export function shiftMonth(key: string, n: number): string {
  const y = Number(key.slice(0, 4));
  const m = Number(key.slice(5, 7));
  const d = Number(key.slice(8, 10));
  const total = y * 12 + (m - 1) + n;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return `${pad(ny, 4)}-${pad(nm)}-${pad(Math.min(d, daysIn(ny, nm)))}`;
}

export type PickerMode = 'day' | 'month' | 'year';

function clamp(key: string, min: string | null, max: string | null, mode: PickerMode): string {
  const n = mode === 'day' ? 10 : mode === 'month' ? 7 : 4;
  const k = key.slice(0, n);
  if (min !== null && k < min.slice(0, n)) return mode === 'day' ? min : mode === 'month' ? min.slice(0, 7) + '-01' : min.slice(0, 4) + '-01-01';
  if (max !== null && k > max.slice(0, n)) return mode === 'day' ? max : mode === 'month' ? max.slice(0, 7) + '-01' : max.slice(0, 4) + '-01-01';
  return key;
}

/**
 * Neue Position nach einer Taste, immer innerhalb von [min, max]; null bei Tasten ohne Bewegung.
 * Tag: Pfeile ±1 / ±7, Pos1/Ende = Wochenanfang/-ende, Bild auf/ab = Monat.
 * Monat: Pfeile ±1 / ±3, Pos1/Ende = Zeilenanfang/-ende (je drei Monate), Bild auf/ab = Jahr.
 * Jahr: Pfeile ±1 / ±3, Pos1/Ende = Zeilenanfang/-ende (je drei Jahre ab dem ersten), Bild auf/ab = 12 Jahre.
 */
export function moveCell(mode: PickerMode, key: string, name: string, min: string | null, max: string | null, firstYear = 0): string | null {
  let next: string;
  if (mode === 'day') {
    switch (name) {
      case 'ArrowLeft': next = addDays(key, -1); break;
      case 'ArrowRight': next = addDays(key, 1); break;
      case 'ArrowUp': next = addDays(key, -7); break;
      case 'ArrowDown': next = addDays(key, 7); break;
      case 'Home': next = addDays(key, -weekdayIndex(key)); break;
      case 'End': next = addDays(key, 6 - weekdayIndex(key)); break;
      case 'PageUp': next = shiftMonth(key, -1); break;
      case 'PageDown': next = shiftMonth(key, 1); break;
      default: return null;
    }
    return clamp(next, min, max, 'day');
  }
  if (mode === 'month') {
    const m = Number(key.slice(5, 7)) - 1;
    switch (name) {
      case 'ArrowLeft': next = shiftMonth(key, -1); break;
      case 'ArrowRight': next = shiftMonth(key, 1); break;
      case 'ArrowUp': next = shiftMonth(key, -3); break;
      case 'ArrowDown': next = shiftMonth(key, 3); break;
      case 'Home': next = shiftMonth(key, -(m % 3)); break;
      case 'End': next = shiftMonth(key, 2 - (m % 3)); break;
      case 'PageUp': next = shiftMonth(key, -12); break;
      case 'PageDown': next = shiftMonth(key, 12); break;
      default: return null;
    }
    return clamp(next.slice(0, 7) + '-01', min, max, 'month');
  }
  const y = Number(key.slice(0, 4));
  const col = (y - firstYear) % 3;
  const dy: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -3, ArrowDown: 3, Home: -col, End: 2 - col, PageUp: -12, PageDown: 12 };
  if (!(name in dy)) return null;
  return clamp(`${pad(y + dy[name], 4)}-01-01`, min, max, 'year');
}
