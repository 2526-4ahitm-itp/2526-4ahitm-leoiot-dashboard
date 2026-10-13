// Kopfzeile: Uhr, letzte Aktualisierung und Veraltet-Hinweis.
import { MISSING } from '../core/format';
import { viennaClock, viennaTime } from '../core/time';
import type { KioskView } from '../data/view';

/** Text hinter "Zuletzt aktualisiert:"; reine Funktion. */
export function updatedText(lastDataAt: number | null): string {
  return lastDataAt === null ? MISSING : viennaTime(new Date(lastDataAt));
}

function setText(id: string, text: string): void {
  const el = document.getElementById(id);
  if (el && el.textContent !== text) el.textContent = text;
}

/** Uhr, "Zuletzt aktualisiert" (Messzeit des jüngsten Zählerstands) und Veraltet-Hinweis. */
export function renderHeader(view: KioskView, now: number): void {
  setText('clock', viennaClock(new Date(now)));
  setText('updated', updatedText(view.lastDataAt));
  const stale = document.getElementById('stale');
  if (stale) stale.hidden = !view.stale;
}
