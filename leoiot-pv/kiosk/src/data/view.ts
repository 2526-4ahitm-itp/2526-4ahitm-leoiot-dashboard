// Aufbereitung für die Anzeige: reine Funktion aus Zustand und Uhrzeit.
import {
  consumption,
  consumptionShares,
  productionShares,
  weekValues,
  type Counters,
  type DayValues,
  type Power,
  type Share,
} from '../core/energy';
import { averagePower, powerSeries, type PowerPoint } from '../core/influx';
import { weekRangeLabel } from '@leoiot-pv/shared/time';
import type { KioskState } from './store';

export const STALE_MS = 5 * 60_000; // älter: Daten gelten als veraltet
export const LIVE_MAX_AGE_MS = 2 * 60_000; // älter: Live-Leistung zählt nicht mehr

export interface KioskView {
  dayStart: number; // heutiger Wiener Tag, ms
  dayEnd: number;
  today: Counters | null;
  consumptionTotal: number | null;
  productionTotal: number | null;
  consumptionShares: Share[];
  productionShares: Share[];
  week: DayValues[];
  weekLabel: string;
  power: PowerPoint[];
  flow: { power: Power; source: 'live' | 'average' } | null;
  lastDataAt: number | null;
  stale: boolean;
}

/** Alles, was die Anzeige braucht, aus Zustand und Uhrzeit. Reine Funktion. */
export function buildView(state: KioskState, now: number): KioskView {
  const today = state.rows.length > 0 ? state.rows[state.rows.length - 1].counters : null;

  let flow: KioskView['flow'] = null;
  if (state.livePower && now - state.livePower.t <= LIVE_MAX_AGE_MS) {
    flow = { power: state.livePower.power, source: 'live' };
  } else {
    const avg = averagePower(state.rows);
    if (avg) flow = { power: avg.power, source: 'average' };
  }

  return {
    dayStart: state.dayStart,
    dayEnd: state.dayEnd,
    today,
    consumptionTotal: today ? consumption(today) : null,
    productionTotal: today ? today.yield : null,
    consumptionShares: today ? consumptionShares(today) : [],
    productionShares: today ? productionShares(today) : [],
    // Der heutige Balken zeigt denselben Stand wie die Donuts
    week: weekValues(state.weekKeys, { ...state.week, [state.dayKey]: today ?? state.week[state.dayKey] }),
    weekLabel: weekRangeLabel(state.weekKeys),
    power: powerSeries(state.rows, new Date(state.dayStart)),
    flow,
    lastDataAt: state.lastDataAt,
    stale: state.lastDataAt !== null && now - state.lastDataAt > STALE_MS,
  };
}
