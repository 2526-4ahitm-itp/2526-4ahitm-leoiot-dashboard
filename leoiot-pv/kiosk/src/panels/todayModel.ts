// Donut-Modell: Mitte, Legende und Segmente aus Summe und Anteilen. Rein, ohne DOM.
import type { Share, Source } from '@leoiot-pv/shared/energy';
import { formatKwh, formatNumber } from '../core/format';

export interface DonutRow {
  id: string;
  label: string;
  source: Source;
  value: number;
  text: string; // formatKwh(value)
}

export interface DonutModel {
  center: string;
  rows: DonutRow[];
  empty: boolean;
}

/** Mitte, Legende und Segmente eines Donuts; rows behalten die Reihenfolge der shares (absteigend). */
export function donutModel(total: number | null, shares: Share[]): DonutModel {
  return {
    center: formatNumber(total),
    rows: shares.map((s) => ({ id: s.id, label: s.label, source: s.source, value: s.value, text: formatKwh(s.value) })),
    empty: !shares.some((s) => s.value > 0),
  };
}
