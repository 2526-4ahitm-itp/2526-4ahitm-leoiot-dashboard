// Number formats of the panel and the heatmap labels.

export function formatCo2(ppm: number): string {
  return `${Math.round(ppm)} ppm`;
}

/** One decimal, e.g. 21.3°C. */
export function formatTemperature(celsius: number): string {
  return `${celsius.toFixed(1)}°C`;
}

/** One decimal with a space, e.g. 22.4 °C (info panel). */
export function formatTemperatureSpaced(celsius: number): string {
  return `${celsius.toFixed(1)} °C`;
}
