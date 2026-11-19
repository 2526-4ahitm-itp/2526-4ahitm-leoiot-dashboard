// The two-state lamps of temperature and humidity (spec "Temperature and humidity have their own
// lamps"). Pure; the value is compared as shown, so that the lamp always agrees with the number.

/*
 * Ranges after § 28 Bundes-Arbeitsstättenverordnung (B-AStV):
 * - temperature 19 to 25 °C for work with low physical load (Abs. 1 Z 1),
 * - relative humidity 40 to 70 % (Abs. 5 Z 1). The text states this for rooms with air
 *   conditioning; here it is a guide value for every room, not a binding limit.
 * The source has no second step, so there are two states only and no red. The bounds belong to the range.
 */
export const TEMPERATURE_MIN = 19.0;
export const TEMPERATURE_MAX = 25.0;
export const HUMIDITY_MIN = 40;
export const HUMIDITY_MAX = 70;

export type SmallLamp = 'green' | 'amber' | 'off';
export type Direction = 'low' | 'ok' | 'high';

export interface Comfort {
  lamp: SmallLamp;
  /** Which way the value leaves the range; 'ok' inside; null while the lamp is off. */
  direction: Direction | null;
}

export const COMFORT_OFF: Comfort = { lamp: 'off', direction: null };

function classify(shown: number, min: number, max: number): Comfort {
  if (shown < min) return { lamp: 'amber', direction: 'low' };
  if (shown > max) return { lamp: 'amber', direction: 'high' };
  return { lamp: 'green', direction: 'ok' };
}

/** One decimal, rounded half up on the decimal text (18.95 shows as 19.0, like the page's number format). */
function oneDecimal(v: number): number {
  return Math.round(Number((v * 10).toPrecision(12))) / 10;
}

export function temperatureComfort(value: number | null): Comfort {
  if (value === null || !Number.isFinite(value)) return COMFORT_OFF;
  return classify(oneDecimal(value), TEMPERATURE_MIN, TEMPERATURE_MAX);
}

export function humidityComfort(value: number | null): Comfort {
  if (value === null || !Number.isFinite(value)) return COMFORT_OFF;
  return classify(Math.round(value), HUMIDITY_MIN, HUMIDITY_MAX);
}
