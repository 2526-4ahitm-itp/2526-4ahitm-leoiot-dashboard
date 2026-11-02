// Heatmap colour scales (spec model3d/room-heatmap; design D9, D10, D11).

export type Rgb = readonly [number, number, number];
interface Stop {
  at: number;
  rgb: Rgb;
}

export function hexToRgb(hex: string): Rgb {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex([r, g, b]: Rgb): string {
  return '#' + [r, g, b].map((c) => Math.round(c).toString(16).padStart(2, '0')).join('');
}

/** Linear interpolation in RGB between stops; clamped at both ends. */
function scale(stops: readonly Stop[], value: number): string {
  if (value <= stops[0].at) return rgbToHex(stops[0].rgb);
  for (let i = 1; i < stops.length; i++) {
    const a = stops[i - 1];
    const b = stops[i];
    if (value <= b.at) {
      const t = (value - a.at) / (b.at - a.at);
      const mix = (c: number) => a.rgb[c] + (b.rgb[c] - a.rgb[c]) * t;
      return rgbToHex([mix(0), mix(1), mix(2)]);
    }
  }
  return rgbToHex(stops[stops.length - 1].rgb);
}

const TEMPERATURE: readonly Stop[] = [
  { at: 20, rgb: hexToRgb('#8da1d6') },
  { at: 25, rgb: hexToRgb('#d68d8d') },
];

// Continuous, with stops on the FR-07 limits; the exact status is shown beside it (D9)
const CO2: readonly Stop[] = [
  { at: 400, rgb: hexToRgb('#4caf50') },
  { at: 600, rgb: hexToRgb('#ffd54f') },
  { at: 1200, rgb: hexToRgb('#e53935') },
  { at: 2000, rgb: hexToRgb('#8e0000') },
];

export const STALE_COLOUR = '#9e9e9e';

export function temperatureColour(celsius: number): string {
  return scale(TEMPERATURE, celsius);
}

export function co2Colour(ppm: number): string {
  return scale(CO2, ppm);
}

/** Status symbol colours (FR-07), used in the panel and the heatmap labels. */
export const STATUS_COLOUR = { green: '#4caf50', yellow: '#ffd54f', red: '#e53935' } as const;
