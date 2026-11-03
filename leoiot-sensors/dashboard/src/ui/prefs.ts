// Language and theme are kept in the browser. Storage can be missing or throw (private windows,
// blocked site data), so every access is wrapped and the page works without it.
import { DEFAULT_LANG, isLang, type Lang } from '../core/i18n';

export type Theme = 'light' | 'dark';

export const KEY_LANG = 'leoiot-sensors.lang';
export const KEY_THEME = 'leoiot-sensors.theme';

export function isTheme(value: unknown): value is Theme {
  return value === 'light' || value === 'dark';
}

function read(storage: Pick<Storage, 'getItem'> | null, key: string): string | null {
  try {
    return storage ? storage.getItem(key) : null;
  } catch {
    return null;
  }
}

export function write(storage: Pick<Storage, 'setItem'> | null, key: string, value: string): void {
  try {
    storage?.setItem(key, value);
  } catch {
    // not kept; the choice still holds for this visit
  }
}

export interface Prefs {
  lang: Lang;
  /** The visitor's saved theme; null until they chose one (then the system's scheme applies). */
  theme: Theme | null;
}

/** German unless the visitor chose English; the theme only when they chose one. */
export function loadPrefs(storage: Pick<Storage, 'getItem'> | null): Prefs {
  const lang = read(storage, KEY_LANG);
  const theme = read(storage, KEY_THEME);
  return { lang: isLang(lang) ? lang : DEFAULT_LANG, theme: isTheme(theme) ? theme : null };
}

/** The theme in effect: the saved choice, otherwise the browser's colour scheme. */
export function effectiveTheme(saved: Theme | null, prefersDark: boolean): Theme {
  return saved ?? (prefersDark ? 'dark' : 'light');
}
