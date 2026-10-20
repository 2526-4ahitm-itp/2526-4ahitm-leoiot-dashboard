// Texte in Deutsch und Englisch, Zahlen- und Datumsformate je Sprache.
import { formatKw, formatKwh, MISSING, NBSP, type Lang } from '@leoiot-pv/shared/format';

export type { Lang };

export interface Texts {
  brand: string;
  views: { day: string; week: string; month: string; year: string };
  quantities: {
    production: string;
    consumption: string;
    selfConsumption: string;
    fromGrid: string;
    toGrid: string;
    fromBattery: string;
    toBattery: string;
  };
  prev: string;
  next: string;
  today: string;
  chooseDate: string;
  autarky: string;
  selfRate: string;
  autarkyExplain: string;
  selfRateExplain: string;
  noData: string;
  noDataBefore: string;
  gapDay: string;
  incomplete: (n: number) => string;
  ratiosCover: (from: string, to: string) => string;
  notFinished: string;
  noProduction: string;
  live: string;
  avg10: string;
  power: string;
  grid: string;
  battery: string;
  gridIn: string;
  gridOut: string;
  charging: string;
  discharging: string;
  idle: string;
  updated: string;
  outdated: string;
  powerChart: string;
  energyChart: string;
  monthChart: string;
  showTable: string;
  hideTable: string;
  date: string;
  month: string;
  time: string;
  language: string;
  theme: string;
  light: string;
  dark: string;
  week: string;
}

export const TEXT: Record<Lang, Texts> = {
  de: {
    brand: 'LeoIoT PV',
    views: { day: 'Tag', week: 'Woche', month: 'Monat', year: 'Jahr' },
    quantities: {
      production: 'Produktion',
      consumption: 'Verbrauch',
      selfConsumption: 'Eigenverbrauch',
      fromGrid: 'Vom Netz',
      toGrid: 'Ins Netz',
      fromBattery: 'Von Batterie',
      toBattery: 'In Batterie',
    },
    prev: 'Zurück',
    next: 'Weiter',
    today: 'Heute',
    chooseDate: 'Datum wählen',
    autarky: 'Autarkie',
    selfRate: 'Eigenverbrauchsquote',
    autarkyExplain: 'Anteil des Verbrauchs, der nicht aus dem Netz kam.',
    selfRateExplain: 'Anteil der Produktion, der selbst genutzt und nicht ins Netz eingespeist wurde.',
    noData: 'keine Daten',
    noDataBefore: 'Netz, Batterie und Verbrauch werden erst ab 20. April 2026 erfasst.',
    gapDay: 'An diesem Tag wurden keine Werte gespeichert.',
    incomplete: (n) => `unvollständig, ${n} ${n === 1 ? 'Tag' : 'Tage'} ohne Daten`,
    ratiosCover: (from, to) => `Kennzahlen über ${from} bis ${to}`,
    notFinished: 'noch nicht abgeschlossen',
    noProduction: 'Es wurde nichts produziert.',
    live: 'Live',
    avg10: 'Ø letzte 10 Min',
    power: 'Leistung jetzt',
    grid: 'Netz',
    battery: 'Batterie',
    gridIn: 'Bezug',
    gridOut: 'Einspeisung',
    charging: 'lädt',
    discharging: 'entlädt',
    idle: 'ruht',
    updated: 'Zuletzt aktualisiert',
    outdated: 'Daten veraltet',
    powerChart: 'Leistung über den Tag (kW)',
    energyChart: 'Energie pro Tag (kWh)',
    monthChart: 'Energie pro Monat (kWh)',
    showTable: 'Werte als Tabelle',
    hideTable: 'Tabelle ausblenden',
    date: 'Datum',
    month: 'Monat',
    time: 'Uhrzeit',
    language: 'Sprache',
    theme: 'Darstellung',
    light: 'Hell',
    dark: 'Dunkel',
    week: 'KW',
  },
  en: {
    brand: 'LeoIoT PV',
    views: { day: 'Day', week: 'Week', month: 'Month', year: 'Year' },
    quantities: {
      production: 'Production',
      consumption: 'Consumption',
      selfConsumption: 'Self-consumption',
      fromGrid: 'From grid',
      toGrid: 'To grid',
      fromBattery: 'From battery',
      toBattery: 'To battery',
    },
    prev: 'Previous',
    next: 'Next',
    today: 'Today',
    chooseDate: 'Choose date',
    autarky: 'Self-sufficiency',
    selfRate: 'Self-consumption rate',
    autarkyExplain: 'Share of consumption that did not come from the grid.',
    selfRateExplain: 'Share of production used on site instead of fed into the grid.',
    noData: 'no data',
    noDataBefore: 'Grid, battery and consumption are recorded from 20 April 2026 on.',
    gapDay: 'No readings were stored on this day.',
    incomplete: (n) => `incomplete, ${n} ${n === 1 ? 'day' : 'days'} without data`,
    ratiosCover: (from, to) => `Figures cover ${from} to ${to}`,
    notFinished: 'not finished yet',
    noProduction: 'Nothing was produced.',
    live: 'Live',
    avg10: 'Avg. last 10 min',
    power: 'Power now',
    grid: 'Grid',
    battery: 'Battery',
    gridIn: 'importing',
    gridOut: 'exporting',
    charging: 'charging',
    discharging: 'discharging',
    idle: 'idle',
    updated: 'Last updated',
    outdated: 'Data outdated',
    powerChart: 'Power over the day (kW)',
    energyChart: 'Energy per day (kWh)',
    monthChart: 'Energy per month (kWh)',
    showTable: 'Show values as table',
    hideTable: 'Hide table',
    date: 'Date',
    month: 'Month',
    time: 'Time',
    language: 'Language',
    theme: 'Theme',
    light: 'Light',
    dark: 'Dark',
    week: 'Week',
  },
};

/** Gespeicherte Wahl gewinnt; sonst Englisch bei englischer Browsersprache, sonst Deutsch. */
export function initialLang(stored: string | null, navigatorLanguage: string | undefined): Lang {
  if (stored === 'de' || stored === 'en') return stored;
  return (navigatorLanguage ?? '').toLowerCase().startsWith('en') ? 'en' : 'de';
}

export const kwh = (v: number | null | undefined, lang: Lang): string => formatKwh(v, { lang, group: true });
export const kw = (v: number | null | undefined, lang: Lang): string => formatKw(v, { lang, group: true });

/** Ganze Prozent mit geschütztem Leerzeichen ('95 %'); fehlend: '–'. */
export function pct(ratio: number | null | undefined, lang: Lang): string {
  void lang;
  if (ratio === null || ratio === undefined || !Number.isFinite(ratio)) return MISSING;
  return Math.round(ratio * 100) + NBSP + '%';
}

const MONTHS: Record<Lang, string[]> = {
  de: ['Jänner', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
};
const MONTHS_SHORT: Record<Lang, string[]> = {
  de: ['Jän', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
};
const WEEKDAYS: Record<Lang, string[]> = {
  de: ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'],
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
};
const WEEKDAYS_SHORT: Record<Lang, string[]> = {
  de: ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'],
  en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
};

// Teile eines Tagesschlüssels; Wochentag 0 = Sonntag (reine UTC-Rechnung)
function parts(key: string): { y: number; m: number; d: number; wd: number } {
  const [y, m, d] = key.split('-').map(Number);
  return { y, m, d, wd: new Date(Date.UTC(y, m - 1, d)).getUTCDay() };
}

/** '14.10.2026' bzw. '14 Oct 2026'. */
export function dateShort(key: string, lang: Lang): string {
  const { y, m, d } = parts(key);
  return lang === 'en'
    ? `${d} ${MONTHS_SHORT.en[m - 1]} ${y}`
    : `${String(d).padStart(2, '0')}.${String(m).padStart(2, '0')}.${y}`;
}

/** 'Mittwoch, 14. Oktober 2026' bzw. 'Wednesday, 14 October 2026'. */
export function dateLong(key: string, lang: Lang): string {
  const { y, m, d, wd } = parts(key);
  return lang === 'en'
    ? `${WEEKDAYS.en[wd]}, ${d} ${MONTHS.en[m - 1]} ${y}`
    : `${WEEKDAYS.de[wd]}, ${d}. ${MONTHS.de[m - 1]} ${y}`;
}

/** 'Oktober 2026' bzw. 'October 2026'. */
export function monthLabel(key: string, lang: Lang): string {
  const { y, m } = parts(key);
  return `${MONTHS[lang][m - 1]} ${y}`;
}

/** Kurzer Monatsname, z. B. 'Okt' / 'Oct'; month 1..12. */
export function monthShort(month: number, lang: Lang): string {
  return MONTHS_SHORT[lang][month - 1];
}

/** Kurzer Wochentag, z. B. 'Mi' / 'Wed'. */
export function weekdayShort(key: string, lang: Lang): string {
  return WEEKDAYS_SHORT[lang][parts(key).wd];
}

/** Tag und Monat kurz, z. B. '14.10.' / '14 Oct'. */
export function dayMonth(key: string, lang: Lang): string {
  const { m, d } = parts(key);
  return lang === 'en' ? `${d} ${MONTHS_SHORT.en[m - 1]}` : `${String(d).padStart(2, '0')}.${String(m).padStart(2, '0')}.`;
}
