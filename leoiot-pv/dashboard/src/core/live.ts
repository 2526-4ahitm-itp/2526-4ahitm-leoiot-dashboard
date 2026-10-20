// Welche Leistung heute gezeigt wird und ob die Daten veraltet sind (reine Funktionen).
import type { Power } from '@leoiot-pv/shared/energy';
import { averagePower, type CounterRow } from '@leoiot-pv/shared/influx';

export const LIVE_MAX_AGE_MS = 2 * 60_000;
export const STALE_AFTER_MS = 5 * 60_000;

export interface LiveState {
  power: Power;
  label: 'live' | 'avg10';
}

/** Live, wenn die letzte Momentanleistung höchstens zwei Minuten alt ist; sonst der Mittelwert der letzten zehn Minuten. */
export function liveState(
  lastLive: { power: Power; t: number } | null,
  rows: CounterRow[],
  now: number,
): LiveState | null {
  if (lastLive !== null && now - lastLive.t <= LIVE_MAX_AGE_MS) return { power: lastLive.power, label: 'live' };
  const avg = averagePower(rows);
  return avg === null ? null : { power: avg.power, label: 'avg10' };
}

/** Älter als fünf Minuten (oder gar nichts gespeichert). */
export function isStale(lastDataAt: number | null, now: number): boolean {
  return lastDataAt === null || now - lastDataAt > STALE_AFTER_MS;
}
