// What a heatmap shows for one room (spec model3d/room-heatmap).

import { freshness } from './age';
import { co2Colour, STALE_COLOUR, temperatureColour } from './colours';
import { formatCo2, formatTemperature } from './format';
import type { Reading } from './messages';
import { co2Status, type Co2Status } from './status';
import { floorOf, type FloorId } from './rooms';

export type HeatmapKind = 'temperature' | 'co2';

/** Floors that have a heatmap; the whole building and the gym have none. */
export const HEATMAP_FLOORS: readonly FloorId[] = ['U', 'E', '1', '2'];

export type Cell =
  | { kind: 'none' } // no value for this quantity: normal look, label "No data"
  | { kind: 'current'; colour: string; value: number; text: string; status?: Co2Status }
  | { kind: 'stale'; colour: string; value: number; text: string; status?: Co2Status };

export function cell(kind: HeatmapKind, reading: Reading | undefined, now: number): Cell {
  const value = kind === 'co2' ? reading?.co2 : reading?.temperature;
  if (reading === undefined || value === undefined) return { kind: 'none' };
  const text = kind === 'co2' ? formatCo2(value) : formatTemperature(value);
  const status = kind === 'co2' ? co2Status(value) : undefined;
  if (freshness(reading.ts, now) === 'stale') return { kind: 'stale', colour: STALE_COLOUR, value, text, status };
  const colour = kind === 'co2' ? co2Colour(value) : temperatureColour(value);
  return { kind: 'current', colour, value, text, status };
}

/** Rooms a heatmap colours on a floor: only those of that floor itself. */
export function heatmapRooms(floor: FloorId, rooms: Iterable<string>): string[] {
  if (!HEATMAP_FLOORS.includes(floor)) return [];
  return [...rooms].filter((r) => floorOf(r) === floor);
}
