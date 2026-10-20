// Darstellung (hell/dunkel) und Sprache: Wahl aus Speicher oder System, Speichern ohne Absturz.
export type Theme = 'light' | 'dark';
export const THEME_KEY = 'pv-theme';
export const LANG_KEY = 'pv-lang';

/** Gespeicherte Wahl gewinnt, sonst die Einstellung des Systems. */
export function initialTheme(stored: string | null, prefersDark: boolean): Theme {
  if (stored === 'light' || stored === 'dark') return stored;
  return prefersDark ? 'dark' : 'light';
}

/** Liest einen gespeicherten Wert; null, wenn nichts gespeichert oder der Speicher gesperrt ist. */
export function readStored(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Speichert einen Wert; bei gesperrtem Speicher gilt die Wahl nur bis zum Neuladen. */
export function store(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Speicher gesperrt
  }
}

/** Setzt data-theme am Wurzelelement. */
export function applyTheme(theme: Theme, root: HTMLElement = document.documentElement): void {
  root.dataset.theme = theme;
}
