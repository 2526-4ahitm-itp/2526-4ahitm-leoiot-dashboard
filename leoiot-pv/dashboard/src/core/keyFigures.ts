// Kennzahlen eines Zeitraums aus den Tageszeilen (Woche, Monat, Jahr; keine zusätzliche Abfrage).
import { completeCounters } from '@leoiot-pv/shared/energy';
import { quantities, type DayRow, type Quantities } from './periods';

export interface Extreme {
  key: string; // Tag
  value: number; // kWh
  today: boolean; // heute, noch nicht abgeschlossen
}

export interface Mean {
  value: number; // kWh pro Tag
  days: number; // Tage mit Wert
  includesToday: boolean;
}

export interface KeyFigures {
  bestProd: Extreme | null;
  worstProd: Extreme | null;
  maxCons: Extreme | null;
  maxImp: Extreme | null;
  meanProd: Mean | null;
  meanCons: Mean | null;
  /** Anteil der vergangenen Tage mit allen fünf Zählern; null, wenn es noch keinen vergangenen Tag gibt. */
  completeness: { percent: number; complete: number; past: number; includesToday: boolean } | null;
}

/** Kennzahlen über die vergangenen Tage (heute zählt, ist aber als nicht abgeschlossen markiert); Tage ohne Wert zählen nie. */
export function keyFigures(rows: DayRow[]): KeyFigures {
  const past = rows.filter((r) => !r.future);
  const per = past.map((r) => ({ row: r, q: quantities(r.gap ? null : r.counters) }));

  const pick = (field: keyof Quantities, best: 'max' | 'min'): Extreme | null => {
    let found: Extreme | null = null;
    for (const { row, q } of per) {
      const v = q[field];
      if (v === null) continue;
      if (found === null || (best === 'max' ? v > found.value : v < found.value)) found = { key: row.key, value: v, today: row.today };
    }
    return found;
  };
  const mean = (field: keyof Quantities): Mean | null => {
    const withValue = per.filter(({ q }) => q[field] !== null);
    if (withValue.length === 0) return null;
    const sum = withValue.reduce((a, { q }) => a + (q[field] as number), 0);
    return { value: sum / withValue.length, days: withValue.length, includesToday: withValue.some(({ row }) => row.today) };
  };

  const complete = past.filter((r) => completeCounters(r.counters) !== null);
  return {
    bestProd: pick('prod', 'max'),
    worstProd: pick('prod', 'min'),
    maxCons: pick('cons', 'max'),
    maxImp: pick('imp', 'max'),
    meanProd: mean('prod'),
    meanCons: mean('cons'),
    completeness:
      past.length === 0
        ? null
        : {
            percent: Math.round((complete.length / past.length) * 100),
            complete: complete.length,
            past: past.length,
            includesToday: past.some((r) => r.today),
          },
  };
}
