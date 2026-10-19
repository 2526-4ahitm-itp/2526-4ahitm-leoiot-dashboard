// Reine Zeitfunktionen in Wiener Zeit. Keine Funktion liest die aktuelle Uhrzeit selbst.

export const ZONE = 'Europe/Vienna';
export const SLOT_MS = 5 * 60 * 1000;

const MONTHS = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

const keyFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const partsFormat = new Intl.DateTimeFormat('en-US', {
  timeZone: ZONE,
  hourCycle: 'h23',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  second: 'numeric',
});

const timeFormat = new Intl.DateTimeFormat('de-AT', {
  timeZone: ZONE,
  hourCycle: 'h23',
  hour: '2-digit',
  minute: '2-digit',
});

const clockFormat = new Intl.DateTimeFormat('de-AT', {
  timeZone: ZONE,
  hourCycle: 'h23',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function partMap(fmt: Intl.DateTimeFormat, at: Date): Record<string, string> {
  const out: Record<string, string> = {};
  for (const p of fmt.formatToParts(at)) out[p.type] = p.value;
  return out;
}

/** Versatz Wien gegen UTC zu diesem Zeitpunkt in Millisekunden. */
function offsetMs(at: Date): number {
  const p = partMap(partsFormat, at);
  const asUtc = Date.UTC(
    Number(p.year),
    Number(p.month) - 1,
    Number(p.day),
    Number(p.hour),
    Number(p.minute),
    Number(p.second),
  );
  return asUtc - Math.floor(at.getTime() / 1000) * 1000;
}

function parseKey(dateKey: string): [number, number, number] {
  const [y, m, d] = dateKey.split('-').map(Number);
  return [y, m, d];
}

/** Wiener Kalendertag eines Zeitpunkts als 'YYYY-MM-DD'. */
export function viennaDateKey(at: Date): string {
  const p = partMap(keyFormat, at);
  return `${p.year}-${p.month}-${p.day}`;
}

/** Zeitpunkt von 00:00 Wiener Zeit an diesem Kalendertag. */
export function viennaDayStart(dateKey: string): Date {
  const [y, m, d] = parseKey(dateKey);
  const utc = Date.UTC(y, m - 1, d);
  // Zweiter Durchgang, damit der Versatz am Mitternachtszeitpunkt selbst stimmt
  let t = utc - offsetMs(new Date(utc));
  t = utc - offsetMs(new Date(t));
  return new Date(t);
}

/** Kalendertag plus n Tage (n darf negativ sein), reine Datumsrechnung. */
export function addDays(dateKey: string, n: number): string {
  const [y, m, d] = parseKey(dateKey);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return `${String(dt.getUTCFullYear()).padStart(4, '0')}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

/** Heutiger Wiener Tag: Schlüssel, Beginn und Ende (= Beginn des Folgetags). */
export function dayRange(at: Date): { key: string; start: Date; end: Date } {
  const key = viennaDateKey(at);
  return { key, start: viennaDayStart(key), end: viennaDayStart(addDays(key, 1)) };
}

/** Die letzten sieben Wiener Kalendertage, aufsteigend, der letzte ist heute. */
export function weekKeys(at: Date): string[] {
  const today = viennaDateKey(at);
  const keys: string[] = [];
  for (let i = -6; i <= 0; i++) keys.push(addDays(today, i));
  return keys;
}

/** Bereich der Wochenübersicht: Beginn des ältesten Tags bis Ende von heute. */
export function weekRange(at: Date): { keys: string[]; start: Date; end: Date } {
  const keys = weekKeys(at);
  return { keys, start: viennaDayStart(keys[0]), end: dayRange(at).end };
}

/** Index des 5-Minuten-Fensters seit Tagesbeginn (0 = erste fünf Minuten). */
export function slotIndex(at: Date, dayStart: Date): number {
  return Math.floor((at.getTime() - dayStart.getTime()) / SLOT_MS);
}

/** Anzahl der 5-Minuten-Fenster des Tages (288, an Umstellungstagen 276 oder 300). */
export function slotCount(dateKey: string): number {
  const span = viennaDayStart(addDays(dateKey, 1)).getTime() - viennaDayStart(dateKey).getTime();
  return span / SLOT_MS;
}

/** 'HH:MM' in Wiener Zeit (24 h). */
export function viennaTime(at: Date): string {
  const p = partMap(timeFormat, at);
  return `${p.hour}:${p.minute}`;
}

/** 'HH:MM:SS' in Wiener Zeit (24 h). */
export function viennaClock(at: Date): string {
  const p = partMap(clockFormat, at);
  return `${p.hour}:${p.minute}:${p.second}`;
}

/** Achsenbeschriftung eines Tages, z. B. '07 Okt'. */
export function dayLabel(dateKey: string): string {
  const [, m, d] = parseKey(dateKey);
  return `${pad(d)} ${MONTHS[m - 1]}`;
}

/** Datumsbereich, z. B. '01.10. – 07.10.2026' (erster und letzter Schlüssel). */
export function weekRangeLabel(keys: string[]): string {
  if (keys.length === 0) return '';
  const [, fm, fd] = parseKey(keys[0]);
  const [ly, lm, ld] = parseKey(keys[keys.length - 1]);
  return `${pad(fd)}.${pad(fm)}. – ${pad(ld)}.${pad(lm)}.${ly}`;
}

/** Millisekunden bis zum nächsten Wiener Tagesbeginn (immer > 0). */
export function msUntilNextDay(at: Date): number {
  return dayRange(at).end.getTime() - at.getTime();
}
