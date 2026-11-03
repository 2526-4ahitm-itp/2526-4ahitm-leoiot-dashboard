import { describe, expect, it } from 'vitest';
import { createQuality } from '../src/ui/quality';

describe('Anpassung an das Gerät', () => {
  it('senkt erst die Auflösung, dann die Schatten, wenn zwei Fenster nacheinander zu langsam sind', () => {
    const steps: { pixelRatio: number; shadows: boolean }[] = [];
    const q = createQuality((d) => steps.push(d));
    for (let t = 0; t <= 60_000; t += 50) q.frame(t); // 20 Bilder pro Sekunde
    expect(steps[0].pixelRatio).toBeLessThan(1);
    expect(steps.at(-1)).toEqual({ pixelRatio: 0.5, shadows: false });
  });
  it('ändert nichts bei 60 Bildern pro Sekunde', () => {
    const steps: unknown[] = [];
    const q = createQuality((d) => steps.push(d));
    for (let t = 0; t <= 20_000; t += 1000 / 60) q.frame(t);
    expect(steps).toHaveLength(0);
  });
});
