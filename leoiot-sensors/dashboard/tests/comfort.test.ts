import { describe, expect, it } from 'vitest';
import { humidityComfort, temperatureComfort } from '../src/core/comfort';
import { makeFormat } from '../src/core/format';

describe('temperature lamp (§ 28 B-AStV: 19 to 25 °C, bounds belong to the range)', () => {
  it.each([
    [18.9, 'amber', 'low'],
    [19.0, 'green', 'ok'],
    [22, 'green', 'ok'],
    [25.0, 'green', 'ok'],
    [25.1, 'amber', 'high'],
  ] as const)('%s °C', (v, lamp, direction) => {
    expect(temperatureComfort(v)).toEqual({ lamp, direction });
  });
  it('is compared as shown, with one decimal', () => {
    expect(temperatureComfort(18.95)).toEqual({ lamp: 'green', direction: 'ok' }); // shows as 19.0
    expect(temperatureComfort(18.94)).toEqual({ lamp: 'amber', direction: 'low' }); // shows as 18.9
    expect(temperatureComfort(25.04)).toEqual({ lamp: 'green', direction: 'ok' }); // shows as 25.0
    expect(temperatureComfort(25.05)).toEqual({ lamp: 'amber', direction: 'high' }); // shows as 25.1
    const f = makeFormat('en');
    for (const v of [18.95, 18.94, 25.04, 25.05]) expect(temperatureComfort(v).direction === 'ok').toBe(Number(f.number(v, 1)) >= 19 && Number(f.number(v, 1)) <= 25);
  });
  it('an unknown value leaves the lamp off', () => {
    expect(temperatureComfort(null)).toEqual({ lamp: 'off', direction: null });
    expect(temperatureComfort(Number.NaN)).toEqual({ lamp: 'off', direction: null });
  });
});

describe('humidity lamp (§ 28 B-AStV: 40 to 70 % as guide value)', () => {
  it.each([
    [39, 'amber', 'low'],
    [40, 'green', 'ok'],
    [70, 'green', 'ok'],
    [71, 'amber', 'high'],
  ] as const)('%s %%', (v, lamp, direction) => {
    expect(humidityComfort(v)).toEqual({ lamp, direction });
  });
  it('is compared without decimals', () => {
    expect(humidityComfort(39.5)).toEqual({ lamp: 'green', direction: 'ok' }); // shows as 40
    expect(humidityComfort(39.4)).toEqual({ lamp: 'amber', direction: 'low' });
    expect(humidityComfort(70.4)).toEqual({ lamp: 'green', direction: 'ok' });
    expect(humidityComfort(70.5)).toEqual({ lamp: 'amber', direction: 'high' });
  });
  it('an unknown value leaves the lamp off', () => {
    expect(humidityComfort(null)).toEqual({ lamp: 'off', direction: null });
  });
});
