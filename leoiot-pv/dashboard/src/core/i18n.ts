// Texte in Deutsch und Englisch, Zahlen- und Datumsformate je Sprache.
import { formatKw, formatKwh, MISSING, NBSP, type Lang } from '@leoiot-pv/shared/format';

export type { Lang };

/** Größen und Kennzahlen, zu denen es eine Erklärung gibt. */
export const EXPLAIN_KEYS = [
  'prod', 'cons', 'self', 'imp', 'exp', 'dis', 'chg', 'autarky', 'selfRate',
  'prodPeak', 'gridPeak', 'baseLoad', 'bestDay', 'worstDay', 'maxCons', 'maxImp', 'meanDay', 'completeness',
] as const;
export type ExplainKey = (typeof EXPLAIN_KEYS)[number];

export interface GuideTexts {
  summary: string;
  kwTitle: string;
  kwText: string;
  flowTitle: string;
  flowAlt: string;
  plant: string;
  school: string;
  grid: string;
  battery: string;
  formulasTitle: string;
  formulas: string[];
  noDataTitle: string;
  noDataText: string;
  sourceTitle: string;
  sourceText: string;
}

export interface Texts {
  brand: string;
  explain: Record<ExplainKey, string>;
  names: { prodPeak: string; gridPeak: string; baseLoad: string; bestDay: string; worstDay: string; maxCons: string; maxImp: string; meanDay: string; completeness: string };
  infoLabel: (name: string) => string;
  atTime: (time: string) => string;
  soFar: string;
  peaksTitle: string;
  keyFiguresTitle: string;
  completenessValue: (percent: string, complete: number, past: number) => string;
  noGridDraw: string;
  guide: GuideTexts;
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
  totalsExclude: (n: number, ranges: string) => string;
  weekShort: string;
  avg15: string;
  prevMonth: string;
  nextMonth: string;
  prevYear: string;
  nextYear: string;
  years: string;
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
  loadError: string;
  loading: string;
  hourlyMean: string;
  figures: string;
  viewLabel: string;
  period: string;
}

export const TEXT: Record<Lang, Texts> = {
  de: {
    brand: 'LeoIoT PV',
    explain: {
      prod: 'Gesamter Strom, den die Anlage erzeugt hat. In kWh.',
      cons: 'Gesamter Strom, den die Schule verbraucht hat, ob aus der Anlage, aus der Batterie oder aus dem Netz. In kWh.',
      self: 'Strom aus der Anlage, den die Schule direkt verbraucht hat, ohne Umweg über Batterie oder Netz. In kWh.',
      imp: 'Strom, den die Schule aus dem öffentlichen Netz bezogen hat. In kWh.',
      exp: 'Strom aus der Anlage, der ins öffentliche Netz eingespeist wurde. In kWh.',
      dis: 'Strom, den die Batterie abgegeben hat und den die Schule verbraucht hat. In kWh.',
      chg: 'Strom aus der Anlage, der in die Batterie geladen wurde. In kWh.',
      autarky: 'Anteil des Verbrauchs, der nicht aus dem Netz kam. Je höher, desto unabhängiger ist die Schule. In Prozent.',
      selfRate: 'Anteil der Produktion, der selbst genutzt und nicht ins Netz eingespeist wurde. In Prozent.',
      prodPeak: 'Höchste Leistung der Anlage an diesem Tag, als Mittel über 15 Minuten. In kW.',
      gridPeak: 'Höchste Leistung, die die Schule an diesem Tag aus dem Netz bezogen hat, als Mittel über 15 Minuten. In kW.',
      baseLoad: 'Mittlere Leistung, die die Schule zwischen 0 und 4 Uhr braucht, wenn niemand da ist: Server, Lüftung, Geräte im Standby. In kW.',
      bestDay: 'Der Tag des Zeitraums mit der höchsten Produktion. In kWh.',
      worstDay: 'Der Tag des Zeitraums mit der niedrigsten Produktion. Tage ohne gespeicherte Werte zählen nicht. In kWh.',
      maxCons: 'Der Tag des Zeitraums mit dem höchsten Verbrauch. In kWh.',
      maxImp: 'Der Tag des Zeitraums, an dem am meisten Strom aus dem Netz bezogen wurde. In kWh.',
      meanDay: 'Durchschnitt pro Tag über die Tage, für die ein Wert gespeichert ist. Tage ohne Daten senken ihn nicht. In kWh.',
      completeness: 'Anteil der vergangenen Tage des Zeitraums, für die alle Zählerwerte gespeichert wurden. In Prozent.',
    },
    names: {
      prodPeak: 'Spitzenleistung',
      gridPeak: 'Höchster Netzbezug',
      baseLoad: 'Grundlast',
      bestDay: 'Bester Tag',
      worstDay: 'Schwächster Tag',
      maxCons: 'Höchster Verbrauch',
      maxImp: 'Höchster Netzbezug',
      meanDay: 'Ø pro Tag',
      completeness: 'Vollständigkeit',
    },
    infoLabel: (name) => `Erklärung: ${name}`,
    atTime: (t) => `um ${t}`,
    soFar: 'bisher',
    peaksTitle: 'Spitzen des Tages',
    keyFiguresTitle: 'Kennzahlen des Zeitraums',
    completenessValue: (p, c, n) => `${p} (${c} von ${n} Tagen)`,
    noGridDraw: 'kein Netzbezug',
    guide: {
      summary: 'So lesen Sie das Dashboard',
      kwTitle: 'kW und kWh',
      kwText:
        'Leistung in kW ist die momentane Rate, mit der Strom erzeugt oder verbraucht wird. Energie in kWh ist die Menge über eine Zeit. 10 kW über 2 Stunden ergeben 20 kWh. Die Kurve des Tages zeigt Leistung, die Balken und Zahlen zeigen Energie.',
      flowTitle: 'Wohin der Strom fließt',
      flowAlt:
        'Skizze des Energieflusses: Die Anlage liefert Strom an die Schule (Eigenverbrauch), in die Batterie (In Batterie) und ins Netz (Ins Netz). Die Schule bezieht Strom aus dem Netz (Vom Netz) und aus der Batterie (Von Batterie). Produktion ist die Summe der Anlage, Verbrauch die Summe der Schule.',
      plant: 'Anlage',
      school: 'Schule',
      grid: 'Netz',
      battery: 'Batterie',
      formulasTitle: 'Wie gerechnet wird',
      formulas: [
        'Eigenverbrauch = Produktion − Ins Netz − In Batterie',
        'Verbrauch = Eigenverbrauch + Vom Netz + Von Batterie',
        'Autarkie = (Verbrauch − Vom Netz) / Verbrauch',
        'Eigenverbrauchsquote = (Produktion − Ins Netz) / Produktion',
      ],
      noDataTitle: 'Was „keine Daten“ heißt',
      noDataText:
        'Für diese Zeit wurde kein Wert gespeichert. Das Dashboard zeigt das als unbekannt und nie als 0. Vollständige Messwerte gibt es ab dem 20. April 2026.',
      sourceTitle: 'Woher die Daten kommen',
      sourceText:
        'Die Daten stammen von der Anlage der Schule, ein Messwert pro Minute. Die Leistung jetzt wird etwa alle zwei Sekunden aktualisiert. Die Tageswerte sind der letzte Messwert jedes Tages nach Wiener Zeit.',
    },
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
    totalsExclude: (n, ranges) => `Summen ohne ${n} ${n === 1 ? 'Tag' : 'Tage'} ohne Daten${ranges ? ` (${ranges})` : ''}`,
    weekShort: 'KW',
    avg15: 'Ø 15 Min',
    prevMonth: 'Vorheriger Monat',
    nextMonth: 'Nächster Monat',
    prevYear: 'Vorheriges Jahr',
    nextYear: 'Nächstes Jahr',
    years: 'Jahre',
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
    loadError: 'Die Daten konnten nicht geladen werden. Die Seite versucht es automatisch erneut.',
    loading: 'Daten werden geladen …',
    hourlyMean: 'Mittlere Leistung je Stunde (kW)',
    figures: 'Zahlen im Überblick',
    viewLabel: 'Ansicht',
    period: 'Zeitraum',
  },
  en: {
    brand: 'LeoIoT PV',
    explain: {
      prod: 'All electricity the plant generated. In kWh.',
      cons: 'All electricity the school used, whether it came from the plant, the battery or the grid. In kWh.',
      self: 'Electricity from the plant that the school used directly, without going through the battery or the grid. In kWh.',
      imp: 'Electricity the school drew from the public grid. In kWh.',
      exp: 'Electricity from the plant that was fed into the public grid. In kWh.',
      dis: 'Electricity the battery gave out and the school used. In kWh.',
      chg: 'Electricity from the plant that was charged into the battery. In kWh.',
      autarky: 'Share of consumption that did not come from the grid. The higher, the more independent the school is. In percent.',
      selfRate: 'Share of production used on site instead of fed into the grid. In percent.',
      prodPeak: "The plant's highest power on this day, as a 15-minute average. In kW.",
      gridPeak: 'The highest power the school drew from the grid on this day, as a 15-minute average. In kW.',
      baseLoad: 'Mean power the school needs between 0 and 4 a.m. when nobody is there: servers, ventilation, devices on standby. In kW.',
      bestDay: 'The day of the period with the highest production. In kWh.',
      worstDay: 'The day of the period with the lowest production. Days without stored readings do not count. In kWh.',
      maxCons: 'The day of the period with the highest consumption. In kWh.',
      maxImp: 'The day of the period on which the most electricity was drawn from the grid. In kWh.',
      meanDay: 'Average per day over the days that have a stored value. Days without data do not lower it. In kWh.',
      completeness: 'Share of the past days of the period for which all counter readings were stored. In percent.',
    },
    names: {
      prodPeak: 'Peak power',
      gridPeak: 'Highest grid draw',
      baseLoad: 'Base load',
      bestDay: 'Best day',
      worstDay: 'Weakest day',
      maxCons: 'Highest consumption',
      maxImp: 'Highest grid draw',
      meanDay: 'Avg. per day',
      completeness: 'Completeness',
    },
    infoLabel: (name) => `Explanation: ${name}`,
    atTime: (t) => `at ${t}`,
    soFar: 'so far',
    peaksTitle: 'Peaks of the day',
    keyFiguresTitle: 'Key figures of the period',
    completenessValue: (p, c, n) => `${p} (${c} of ${n} days)`,
    noGridDraw: 'no grid draw',
    guide: {
      summary: 'How to read this dashboard',
      kwTitle: 'kW and kWh',
      kwText:
        'Power in kW is the momentary rate at which electricity is generated or used. Energy in kWh is the amount over a period of time. 10 kW for 2 hours make 20 kWh. The curve of a day shows power, the bars and figures show energy.',
      flowTitle: 'Where the electricity flows',
      flowAlt:
        'Sketch of the energy flow: the plant supplies the school (Self-consumption), the battery (To battery) and the grid (To grid). The school draws from the grid (From grid) and from the battery (From battery). Production is the total of the plant, Consumption the total of the school.',
      plant: 'Plant',
      school: 'School',
      grid: 'Grid',
      battery: 'Battery',
      formulasTitle: 'How it is calculated',
      formulas: [
        'Self-consumption = Production − To grid − To battery',
        'Consumption = Self-consumption + From grid + From battery',
        'Self-sufficiency = (Consumption − From grid) / Consumption',
        'Self-consumption rate = (Production − To grid) / Production',
      ],
      noDataTitle: 'What "no data" means',
      noDataText:
        'No reading was stored for this time. The dashboard shows it as unknown and never as 0. Complete readings exist from 20 April 2026.',
      sourceTitle: 'Where the data comes from',
      sourceText:
        "The data comes from the school's plant, one reading per minute. The power now is updated about every two seconds. Day totals are the last reading of each day in Vienna time.",
    },
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
    totalsExclude: (n, ranges) => `Totals exclude ${n} ${n === 1 ? 'day' : 'days'} without data${ranges ? ` (${ranges})` : ''}`,
    weekShort: 'Wk',
    avg15: '15-min avg',
    prevMonth: 'Previous month',
    nextMonth: 'Next month',
    prevYear: 'Previous year',
    nextYear: 'Next year',
    years: 'Years',
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
    loadError: 'The data could not be loaded. The page tries again automatically.',
    loading: 'Loading data …',
    hourlyMean: 'Mean power per hour (kW)',
    figures: 'Figures at a glance',
    viewLabel: 'View',
    period: 'Period',
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

/** Voller Monatsname, month 1..12. */
export function monthName(month: number, lang: Lang): string {
  return MONTHS[lang][month - 1];
}

/** Kurzer Wochentag, i 0..6 mit Montag = 0. */
export function weekdayByIndex(i: number, lang: Lang): string {
  return WEEKDAYS_SHORT[lang][(i + 1) % 7];
}
