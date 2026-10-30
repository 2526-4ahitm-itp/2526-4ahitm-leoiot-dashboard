import { describe, expect, it } from 'vitest';
import { co2Colour, hexToRgb, rgbToHex, temperatureColour } from '../src/core/colours';

describe('temperatureColour', () => {
  it.each([
    [18, '#8da1d6'],
    [20, '#8da1d6'],
    [25, '#d68d8d'],
    [27.5, '#d68d8d'],
  ])('%d °C → %s', (c, hex) => expect(temperatureColour(c)).toBe(hex));

  it('22.5 °C is halfway', () => {
    const [a, b, mid] = [hexToRgb('#8da1d6'), hexToRgb('#d68d8d'), hexToRgb(temperatureColour(22.5))];
    mid.forEach((c, i) => expect(Math.abs(c - (a[i] + b[i]) / 2)).toBeLessThanOrEqual(0.5));
  });
});

describe('co2Colour', () => {
  it.each([
    [300, '#4caf50'],
    [400, '#4caf50'],
    [600, '#ffd54f'],
    [1200, '#e53935'],
    [2000, '#8e0000'],
    [2600, '#8e0000'],
  ])('%d ppm → %s', (ppm, hex) => expect(co2Colour(ppm)).toBe(hex));

  it('400 and 599 ppm differ visibly', () => {
    const [a, b] = [hexToRgb(co2Colour(400)), hexToRgb(co2Colour(599))];
    expect(a.reduce((sum, c, i) => sum + Math.abs(c - b[i]), 0)).toBeGreaterThan(100);
  });

  it('1200 and 1201 ppm look almost the same (no jump)', () => {
    const [a, b] = [hexToRgb(co2Colour(1200)), hexToRgb(co2Colour(1201))];
    expect(a.reduce((sum, c, i) => sum + Math.abs(c - b[i]), 0)).toBeLessThan(6);
  });
});

it('hex round trip', () => expect(rgbToHex(hexToRgb('#0a0b0c'))).toBe('#0a0b0c'));
