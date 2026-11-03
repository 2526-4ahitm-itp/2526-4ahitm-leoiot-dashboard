// Nächtliches Neuladen, damit ein neuer Stand nach einem Deploy ankommt und das Jahr frisch geladen wird.
import { dayRange } from '@leoiot-pv/shared/time';

export const RELOAD_AFTER_MIDNIGHT_MS = 3.5 * 60 * 60_000; // 03:30 Wiener Zeit
export const RELOAD_RETRY_MS = 10 * 60_000;

/** Millisekunden bis zum nächsten Neuladen (immer > 0). */
export function msUntilReload(now: Date): number {
  const day = dayRange(now);
  const t = day.start.getTime() + RELOAD_AFTER_MIDNIGHT_MS;
  return t > now.getTime() ? t - now.getTime() : day.end.getTime() + RELOAD_AFTER_MIDNIGHT_MS - now.getTime();
}

/** Lädt die Seite jede Nacht neu, aber nur, wenn der Server antwortet. */
export function scheduleNightlyReload(base: string): void {
  const tryReload = (): void => {
    fetch(base, { cache: 'no-store', signal: AbortSignal.timeout(10_000) })
      .then((r) => (r.ok ? location.reload() : setTimeout(tryReload, RELOAD_RETRY_MS)))
      .catch(() => setTimeout(tryReload, RELOAD_RETRY_MS));
  };
  setTimeout(tryReload, msUntilReload(new Date()));
}
