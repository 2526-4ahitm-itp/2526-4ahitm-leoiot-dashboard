// CO₂ status after FSD FR-07: green < 600 ppm, yellow 600–1200 ppm, red > 1200 ppm.

export type Co2Status = 'green' | 'yellow' | 'red';

export function co2Status(ppm: number): Co2Status {
  if (ppm < 600) return 'green';
  if (ppm <= 1200) return 'yellow';
  return 'red';
}
