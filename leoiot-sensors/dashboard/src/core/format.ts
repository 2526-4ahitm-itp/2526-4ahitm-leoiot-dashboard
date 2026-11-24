// Numbers, times and ages in the language of the page. Times are always the school's local time.
import type { Lang } from './i18n';

export const TIME_ZONE = 'Europe/Vienna';

/** Offset of the school's time zone to UTC at an instant, in ms (summer time +2 h, winter time +1 h). */
export function zoneOffset(ms: number): number {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: TIME_ZONE, year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric', hourCycle: 'h23' }).formatToParts(ms);
  const n = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return Date.UTC(n('year'), n('month') - 1, n('day'), n('hour'), n('minute'), n('second')) - Math.floor(ms / 1000) * 1000;
}

/** The instant of the most recent local midnight (Europe/Vienna), also on days with a clock change. */
export function startOfLocalDay(ms: number): number {
  const local = new Date(ms + zoneOffset(ms));
  const wallMidnight = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
  // The offset at midnight can differ from the one at `ms` (clock change during the day): settle on it.
  let guess = wallMidnight - zoneOffset(wallMidnight);
  guess = wallMidnight - zoneOffset(guess);
  return guess;
}

/** The local calendar date (Europe/Vienna) of an instant as `YYYY-MM-DD`. */
export function localDate(ms: number): string {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(ms);
  const n = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${n('year')}-${n('month')}-${n('day')}`;
}

/** The date `days` after (or before, when negative) a `YYYY-MM-DD` date. */
export function shiftDate(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** The instant of local midnight (Europe/Vienna) at the start of a `YYYY-MM-DD` date; 23 or 25 hours long on clock-change days. */
export function localMidnight(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  const wall = Date.UTC(y, m - 1, d);
  let guess = wall - zoneOffset(wall);
  guess = wall - zoneOffset(guess);
  return guess;
}

const LOCALES: Record<Lang, string> = { de: 'de-AT', en: 'en-GB' };

const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKDAYS_DE = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

export interface Format {
  /** 09:55, or 09:55:03 with seconds. */
  time(ms: number, seconds?: boolean): string;
  /** 16.10. (de) or 16/10 (en). */
  day(ms: number): string;
  /** Mo., 19. (de) or Mon 19 (en), for the axis of the seven-day range. */
  weekdayDay(ms: number): string;
  /** `Dienstag, 24. November` (de) or `Tuesday 24 November` (en). */
  longDate(ms: number): string;
  /** `16.11.` (de) or `16 Nov` (en). */
  dayMonth(ms: number): string;
  /** `16.11.2026` (de) or `16 Nov 2026` (en). */
  dayMonthYear(ms: number): string;
  /** `Di 17.11.` (de) or `Tue 17 Nov` (en). */
  weekdayDate(ms: number): string;
  /** `Di 17.11.2026` (de) or `Tue 17 Nov 2026` (en). */
  weekdayDateYear(ms: number): string;
  /** `16.10., 10:41`. */
  dayTime(ms: number): string;
  /** `16.10., 10:41 – 23.10., 10:41`. */
  window(start: number, end: number): string;
  /** A number with a fixed count of decimals, in the language's number format. */
  number(value: number, decimals: number): string;
  /** Short age as shown next to the time of the latest reading: `12 s`, `3 min`, `2 h 5 min`. */
  ageShort(ms: number): string;
  /** Age as part of a sentence: `12 Minuten`, `3 Stunden`, `2 Tagen` (with the preposition for the language). */
  agoLong(ms: number): string;
}

export function makeFormat(lang: Lang): Format {
  const locale = LOCALES[lang];
  const timeFmt = new Intl.DateTimeFormat(locale, { timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const timeSecFmt = new Intl.DateTimeFormat(locale, { timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
  const dayFmt = new Intl.DateTimeFormat(locale, { timeZone: TIME_ZONE, day: 'numeric', month: 'numeric' });
  const longDateFmt = new Intl.DateTimeFormat(locale, { timeZone: TIME_ZONE, weekday: 'long', day: 'numeric', month: 'long' });
  const weekdayFmt = new Intl.DateTimeFormat(locale, { timeZone: TIME_ZONE, weekday: 'short', day: 'numeric' });
  const numbers = new Map<number, Intl.NumberFormat>();
  const numberFmt = (decimals: number) => {
    let f = numbers.get(decimals);
    if (!f) numbers.set(decimals, (f = new Intl.NumberFormat(locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })));
    return f;
  };
  const time = (ms: number, seconds = false) => (seconds ? timeSecFmt : timeFmt).format(ms);
  const day = (ms: number) => dayFmt.format(ms);
  const dayTime = (ms: number) => `${day(ms)}, ${time(ms)}`;

  const ymd = (ms: number) => {
    const [y, m, d] = localDate(ms).split('-').map(Number);
    return { y, m, d, wd: new Date(Date.UTC(y, m - 1, d)).getUTCDay() };
  };
  const dayMonth = (ms: number) => {
    const { m, d } = ymd(ms);
    return lang === 'de' ? `${d}.${m}.` : `${d} ${MONTHS_EN[m - 1]}`;
  };
  const dayMonthYear = (ms: number) => {
    const { y, m, d } = ymd(ms);
    return lang === 'de' ? `${d}.${m}.${y}` : `${d} ${MONTHS_EN[m - 1]} ${y}`;
  };
  const weekday = (ms: number) => (lang === 'de' ? WEEKDAYS_DE : WEEKDAYS_EN)[ymd(ms).wd];

  return {
    time,
    day,
    longDate: (ms) => longDateFmt.format(ms),
    dayMonth,
    dayMonthYear,
    weekdayDate: (ms) => `${weekday(ms)} ${dayMonth(ms)}`,
    weekdayDateYear: (ms) => `${weekday(ms)} ${dayMonthYear(ms)}`,
    weekdayDay: (ms) => weekdayFmt.format(ms),
    dayTime,
    window: (start, end) => `${dayTime(start)} – ${dayTime(end)}`,
    number: (value, decimals) => numberFmt(decimals).format(value),
    ageShort(ms) {
      const s = Math.max(0, Math.floor(ms / 1000));
      if (s < 60) return `${s} s`;
      const min = Math.floor(s / 60);
      if (min < 60) return `${min} min`;
      const h = Math.floor(min / 60);
      if (h < 24) return min % 60 === 0 ? `${h} h` : `${h} h ${min % 60} min`;
      const d = Math.floor(h / 24);
      return lang === 'de' ? `${d} ${d === 1 ? 'Tag' : 'Tage'}` : `${d} ${d === 1 ? 'day' : 'days'}`;
    },
    agoLong(ms) {
      const min = Math.max(0, Math.floor(ms / 60_000));
      const h = Math.floor(min / 60);
      const d = Math.floor(h / 24);
      const [n, de, en]: [number, string, string] =
        min < 120 ? [min, min === 1 ? 'Minute' : 'Minuten', min === 1 ? 'minute' : 'minutes']
        : h < 48 ? [h, 'Stunden', 'hours']
        : [d, 'Tagen', d === 1 ? 'day' : 'days'];
      return lang === 'de' ? `vor ${n} ${de}` : `${n} ${en} ago`;
    },
  };
}
