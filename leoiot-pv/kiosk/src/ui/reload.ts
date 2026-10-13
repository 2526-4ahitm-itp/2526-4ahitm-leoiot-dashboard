// Nächtliches Neuladen, damit ein neuer Stand nach einem Deploy ankommt.
import { dayRange } from '../core/time';

export const RELOAD_AFTER_MIDNIGHT_MS = 3.5 * 60 * 60_000; // 03:30 Wiener Zeit
export const RELOAD_RETRY_MS = 10 * 60_000;

/** Millisekunden bis zum nächsten Neuladen (immer > 0). Reine Funktion. */
export function msUntilReload(now: Date): number {
  const day = dayRange(now);
  const t = day.start.getTime() + RELOAD_AFTER_MIDNIGHT_MS;
  if (t > now.getTime()) return t - now.getTime();
  return day.end.getTime() + RELOAD_AFTER_MIDNIGHT_MS - now.getTime();
}

/** Lädt die Seite jede Nacht neu, aber nur, wenn der Server antwortet. */
export function scheduleNightlyReload(): void {
  const tryReload = (): void => {
    fetch(import.meta.env.BASE_URL, { cache: 'no-store', signal: AbortSignal.timeout(10000) })
      .then((response) => {
        if (response.ok) location.reload();
        else setTimeout(tryReload, RELOAD_RETRY_MS);
      })
      .catch(() => setTimeout(tryReload, RELOAD_RETRY_MS));
  };
  setTimeout(tryReload, msUntilReload(new Date()));
}
