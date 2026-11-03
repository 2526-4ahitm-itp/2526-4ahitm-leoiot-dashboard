// Numbers, times and ages in the language of the page. Times are always the school's local time.
import type { Lang } from './i18n';

export const TIME_ZONE = 'Europe/Vienna';

const LOCALES: Record<Lang, string> = { de: 'de-AT', en: 'en-GB' };

export interface Format {
  /** 09:55, or 09:55:03 with seconds. */
  time(ms: number, seconds?: boolean): string;
  /** 16.10. (de) or 16/10 (en). */
  day(ms: number): string;
  /** Mo., 19. (de) or Mon 19 (en), for the axis of the seven-day range. */
  weekdayDay(ms: number): string;
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

  return {
    time,
    day,
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
