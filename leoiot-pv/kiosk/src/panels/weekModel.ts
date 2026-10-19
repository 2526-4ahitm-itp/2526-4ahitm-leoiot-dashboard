// Wochenübersicht: Aufbereitung der Chart-Daten, rein und ohne DOM.
import type { DayValues, Source } from '../core/energy';
import { formatTick } from '../core/format';
import { dayLabel } from '@leoiot-pv/shared/time';

export interface WeekSeries {
  label: 'Produktion' | 'Verbrauch' | 'Ins Netz';
  source: Source;
  data: (number | null)[];
}

export interface WeekModel {
  labels: string[];
  series: WeekSeries[];
}

/** Achsenbeschriftung und die drei Reihen der Wochenübersicht, in fester Reihenfolge. */
export function weekModel(week: DayValues[]): WeekModel {
  return {
    labels: week.map((d) => dayLabel(d.key)),
    series: [
      { label: 'Produktion', source: 'pv', data: week.map((d) => d.production) },
      { label: 'Verbrauch', source: 'verbrauch', data: week.map((d) => d.consumption) },
      { label: 'Ins Netz', source: 'netz', data: week.map((d) => d.exported) },
    ],
  };
}

/** Achsenwert in deutscher Schreibweise. */
export function weekTick(v: number | string): string {
  return formatTick(Number(v));
}
