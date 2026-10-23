// A delivered text becomes a reading or is rejected (spec sensors/collector:
// "Invalid values are dropped").
import type { Quantity } from './devices.js';

/** What a room-climate device can measure. */
export const RANGES: Record<Quantity, { min: number; max: number; unit: string }> = {
  co2: { min: 0, max: 10_000, unit: 'ppm' },
  temperature: { min: -40, max: 85, unit: '°C' },
  humidity: { min: 0, max: 100, unit: '%' },
};

export type ParsedValue = { ok: true; value: number } | { ok: false; reason: string };

// Plain decimal numbers only: Number() would also accept '', '0x10' and 'Infinity'.
const NUMBER = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/;

export function parseValue(quantity: Quantity, text: string): ParsedValue {
  const trimmed = text.trim();
  if (!NUMBER.test(trimmed)) return { ok: false, reason: 'not a number' };
  const value = Number(trimmed);
  if (!Number.isFinite(value)) return { ok: false, reason: 'not a finite number' };
  const { min, max } = RANGES[quantity];
  if (value < min || value > max) return { ok: false, reason: `out of range ${min} to ${max}` };
  return { ok: true, value };
}

/** The received text for a log line: quoted and cut, so that it cannot break the line. */
export function quoteReceived(text: string): string {
  const cut = text.length > 40 ? `${text.slice(0, 40)}...` : text;
  return JSON.stringify(cut);
}
