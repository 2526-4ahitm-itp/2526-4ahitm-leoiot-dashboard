// Erkennt Tageszähler, die niedriger sind als in der vorigen Lesung desselben Tages.
// Der Wert wird dabei nie verändert, es wird nur protokolliert (Design D5a).
import type { Log } from '../log.js';
import type { Reading } from './reading.js';

const WATCHED = [
  ['dailyYield', 'daily_yield'],
  ['dailyExported', 'daily_exported'],
  ['dailyImported', 'daily_imported'],
  ['dailyCharged', 'daily_charged'],
  ['dailyDischarged', 'daily_discharged'],
] as const;

const viennaDate = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Europe/Vienna',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/**
 * Tag der Lesung: Datum aus plantLocalTime, falls die Antwort es liefert
 * (JJJJ-MM-TT oder JJJJ/MM/TT am Anfang), sonst das Datum der Wiener Ortszeit.
 */
export function dayKey(result: unknown, nowMs: number): string {
  if (typeof result === 'object' && result !== null) {
    const time = (result as Record<string, unknown>).plantLocalTime;
    if (typeof time === 'string') {
      const match = /^(\d{4})[-/](\d{2})[-/](\d{2})/.exec(time.trim());
      if (match) return `${match[1]}-${match[2]}-${match[3]}`;
    }
  }
  return viennaDate.format(new Date(nowMs));
}

export interface CounterStep {
  field: string;
  previous: number;
  current: number;
}

export function createCounterWatch(log: Log) {
  let day: string | null = null;
  let last: Reading | null = null;

  return {
    /** Vergleicht mit der vorigen Lesung desselben Tages; liefert die Rückschritte. */
    observe(reading: Reading, key: string): CounterStep[] {
      const steps: CounterStep[] = [];
      if (day === key && last) {
        for (const [property, name] of WATCHED) {
          const previous = last[property];
          const current = reading[property];
          if (current < previous) {
            steps.push({ field: name, previous, current });
            log(`Zähler zurückgegangen: ${name} war ${previous}, jetzt ${current} (Wert wird unverändert geliefert)`);
          }
        }
      }
      day = key;
      last = reading;
      return steps;
    },
  };
}
