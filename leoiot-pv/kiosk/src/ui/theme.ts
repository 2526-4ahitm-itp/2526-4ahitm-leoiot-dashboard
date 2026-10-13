// Theme: hell oder dunkel, aus Adresse, gespeicherter Wahl oder Standard.
import logoDark from '../assets/htllogo.png'; // weißes Logo für dunkles Theme
import logoLight from '../assets/htllogoblack.png'; // dunkles Logo für helles Theme

export type Theme = 'light' | 'dark';
export const THEME_KEY = 'leoiot-kiosk-theme';

function asTheme(v: string | null): Theme | null {
  return v === 'dark' || v === 'light' ? v : null;
}

/** Reihenfolge: Adresse (?theme=), gespeicherte Wahl, Standard hell. Reine Funktion. */
export function resolveTheme(search: string, stored: string | null): Theme {
  return asTheme(new URLSearchParams(search).get('theme')) ?? asTheme(stored) ?? 'light';
}

/** Liest die gespeicherte Wahl; null, wenn nichts gespeichert oder der Speicher gesperrt ist. */
export function readStoredTheme(): string | null {
  try {
    return localStorage.getItem(THEME_KEY);
  } catch {
    return null;
  }
}

/** Setzt data-theme, Logo und aria-pressed; speichert die Wahl, wenn save gesetzt ist. */
export function applyTheme(theme: Theme, save: boolean): void {
  document.documentElement.dataset.theme = theme;
  (document.getElementById('logo') as HTMLImageElement).src = theme === 'dark' ? logoDark : logoLight;
  document.getElementById('themeLight')?.setAttribute('aria-pressed', String(theme === 'light'));
  document.getElementById('themeDark')?.setAttribute('aria-pressed', String(theme === 'dark'));
  if (save) {
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // Speicher gesperrt, die Wahl gilt nur bis zum Neuladen
    }
  }
}

/** Stellt das Start-Theme ein und verbindet die beiden Knöpfe; onChange läuft nach jedem Wechsel. */
export function initTheme(onChange: () => void): void {
  applyTheme(resolveTheme(location.search, readStoredTheme()), false);
  for (const [id, theme] of [['themeLight', 'light'], ['themeDark', 'dark']] as const) {
    document.getElementById(id)?.addEventListener('click', () => {
      applyTheme(theme, true);
      onChange();
    });
  }
}
