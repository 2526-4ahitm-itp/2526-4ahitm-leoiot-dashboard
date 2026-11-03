// All texts of the page in German (default) and English. The English table must have exactly the
// keys of the German one; the type below and tests/i18n.test.ts both check it.

export type Lang = 'de' | 'en';
export const LANGS: readonly Lang[] = ['de', 'en'];
export const DEFAULT_LANG: Lang = 'de';

export function isLang(value: unknown): value is Lang {
  return value === 'de' || value === 'en';
}

/** Start of the current uninterrupted run above a limit, as the status reason needs it. */
export interface SinceText {
  time: string;
  /** The run reaches back beyond the shown 24 hours. */
  long: boolean;
}

const de = {
  title: (room: string) => `Raum ${room} · LeoIoT Raumklima`,
  brand: 'LeoIoT',
  brandSub: 'Raumklima',
  room: (id: string) => `Raum ${id}`,
  roomLabel: 'Raum',
  range: 'Zeitraum',
  range24h: '24 h',
  range7d: '7 Tage',
  language: 'Sprache',
  themeToDark: 'Dunkles Design einschalten',
  themeToLight: 'Helles Design einschalten',
  measured: 'gemessen',
  simulated: 'simuliert',
  deviceSensor: (names: string) => `Sensorbox ${names}`,
  deviceOther: (names: string) => `Gerät ${names}`,
  co2: 'CO₂',
  temperature: 'Temperatur',
  humidity: 'Luftfeuchte',
  co2Humidity: 'CO₂ und Luftfeuchte',
  unknown: '–',
  unknownValue: 'unbekannt',
  statusGood: 'Luft gut',
  statusSoon: 'Bald lüften',
  statusBad: 'Jetzt lüften',
  statusStale: 'Keine aktuellen Werte',
  statusNoCo2: 'Kein aktueller CO₂-Wert',
  statusLoading: 'Werte werden geladen',
  whyGood: 'CO₂ liegt unter 800 ppm.',
  whySoon: (s: SinceText) => (s.long ? 'CO₂ liegt seit mehr als 24 Stunden über 800 ppm.' : `CO₂ liegt seit ${s.time} über 800 ppm.`),
  whyBad: (s: SinceText) =>
    s.long ? 'CO₂ liegt seit mehr als 24 Stunden über 1000 ppm. Fenster weit öffnen.' : `CO₂ liegt seit ${s.time} über 1000 ppm. Fenster weit öffnen.`,
  whyNoCo2: 'In den letzten 5 Minuten kam kein CO₂-Wert an. Die übrigen Werte sind aktuell.',
  whyStale: (time: string, ago: string, simulated: boolean) =>
    `Letzter ${simulated ? 'Wert' : 'Messwert'} um ${time}, ${ago}. Die Werte unten sind nicht aktuell.`,
  whyLoading: 'Einen Moment bitte.',
  fresh: (time: string, age: string) => `Stand ${time} · vor ${age}`,
  freshStale: (time: string) => `Zuletzt ${time}`,
  freshFallback: ' · Aktualisierung jede Minute',
  lampGood: 'Ampel grün',
  lampSoon: 'Ampel gelb',
  lampBad: 'Ampel rot',
  lampOff: 'Ampel aus',
  warning: 'Warnung',
  noDataTitle: (id: string) => `Keine Daten für Raum ${id}`,
  noDataText: 'Für diesen Raum liegen keine Messwerte vor. Sobald die Sensorbox wieder sendet, erscheinen sie hier.',
  invalidRoomText: 'Dieser Raumname ist ungültig. Erlaubt sind Buchstaben, Ziffern und Punkte, zum Beispiel 105 oder E10.',
  loadErrorTitle: 'Daten nicht erreichbar',
  loadErrorText: 'Die Messwerte konnten nicht geladen werden. Die Seite versucht es jede Minute erneut.',
  historyEmpty: 'In diesem Zeitraum liegen keine Werte vor.',
  historyError: 'Der Verlauf konnte nicht geladen werden.',
  historyLoading: 'Verlauf wird geladen.',
};

type Texts = typeof de;

const en: Texts = {
  title: (room) => `Room ${room} · LeoIoT Room climate`,
  brand: 'LeoIoT',
  brandSub: 'Room climate',
  room: (id) => `Room ${id}`,
  roomLabel: 'Room',
  range: 'Time range',
  range24h: '24 h',
  range7d: '7 days',
  language: 'Language',
  themeToDark: 'Switch to dark theme',
  themeToLight: 'Switch to light theme',
  measured: 'measured',
  simulated: 'simulated',
  deviceSensor: (names) => `Sensor box ${names}`,
  deviceOther: (names) => `Device ${names}`,
  co2: 'CO₂',
  temperature: 'Temperature',
  humidity: 'Humidity',
  co2Humidity: 'CO₂ and humidity',
  unknown: '–',
  unknownValue: 'unknown',
  statusGood: 'Air is fine',
  statusSoon: 'Air the room soon',
  statusBad: 'Air the room now',
  statusStale: 'No current values',
  statusNoCo2: 'No current CO₂ value',
  statusLoading: 'Loading values',
  whyGood: 'CO₂ is below 800 ppm.',
  whySoon: (s) => (s.long ? 'CO₂ has been above 800 ppm for more than 24 hours.' : `CO₂ has been above 800 ppm since ${s.time}.`),
  whyBad: (s) =>
    s.long ? 'CO₂ has been above 1000 ppm for more than 24 hours. Open the windows wide.' : `CO₂ has been above 1000 ppm since ${s.time}. Open the windows wide.`,
  whyNoCo2: 'No CO₂ value arrived in the last 5 minutes. The other values are current.',
  whyStale: (time, ago) => `Last reading at ${time}, ${ago}. The values below are not current.`,
  whyLoading: 'One moment please.',
  fresh: (time, age) => `As of ${time} · ${age} ago`,
  freshStale: (time) => `Last ${time}`,
  freshFallback: ' · updated every minute',
  lampGood: 'Light green',
  lampSoon: 'Light amber',
  lampBad: 'Light red',
  lampOff: 'Light off',
  warning: 'Warning',
  noDataTitle: (id) => `No data for room ${id}`,
  noDataText: 'There are no readings for this room. They appear here as soon as the sensor box sends again.',
  invalidRoomText: 'This room name is not valid. Letters, digits and dots are allowed, for example 105 or E10.',
  loadErrorTitle: 'Data not reachable',
  loadErrorText: 'The readings could not be loaded. The page tries again every minute.',
  historyEmpty: 'There are no values in this period.',
  historyError: 'The history could not be loaded.',
  historyLoading: 'Loading history.',
};

export type TextKey = keyof Texts;

const TABLES: Record<Lang, Texts> = { de, en };

export function texts(lang: Lang): Texts {
  return TABLES[lang];
}
