import { describe, expect, it } from 'vitest';
import type { PowerPoint } from '@leoiot-pv/shared/influx';
import { HOUR_MS, powerModel, powerScale, powerTick, timeLabel, timeTicks } from '../src/panels/powerModel';

const pt = (production: number | null, consumption: number | null, t = 0): PowerPoint => ({ t, production, consumption });

describe('powerScale', () => {
  it('leer', () => expect(powerScale([])).toEqual({ max: 15, step: 5 }));
  it('Spitze 80 und 142', () => {
    expect(powerScale([pt(80, 0)])).toEqual({ max: 150, step: 50 });
    expect(powerScale([pt(142, 0)])).toEqual({ max: 150, step: 50 });
  });
  it('Spitze 143 braucht den nächsten Schritt', () => expect(powerScale([pt(143, 0)])).toEqual({ max: 300, step: 100 }));
  it('kleine Spitze', () => expect(powerScale([pt(2.4, 0)])).toEqual({ max: 3, step: 1 }));
  it('Spitze aus dem Verbrauch, null übersprungen', () => {
    expect(powerScale([pt(null, null), pt(10, 80)])).toEqual({ max: 150, step: 50 });
  });
});

describe('powerTick', () => {
  it('nie ein Minuszeichen oder Punkt', () => {
    for (const v of [-150, -100, -50, 0, 50, 100, 150, -12.5]) {
      const s = powerTick(v);
      expect(s).not.toContain('-');
      expect(s).not.toContain('−');
      expect(s).not.toContain('.');
    }
    expect(powerTick(-80)).toBe('80');
    expect(powerTick(-12.5)).toBe('12,5');
    expect(powerTick(-0)).toBe('0');
  });
});

describe('powerModel', () => {
  const dayStart = Date.parse('2026-10-06T22:00:00Z');
  const dayEnd = Date.parse('2026-10-07T22:00:00Z');
  const t = dayStart + HOUR_MS;

  it('spiegelt den Verbrauch', () => {
    const m = powerModel([{ t, production: 30, consumption: 80 }], dayStart, dayEnd);
    expect(m.production[0].y).toBe(30);
    expect(m.consumption[0].y).toBe(-80);
  });
  it('null bleibt null, 0 bleibt 0', () => {
    expect(powerModel([pt(1, null, t)], dayStart, dayEnd).consumption[0].y).toBeNull();
    expect(Object.is(powerModel([pt(1, 0, t)], dayStart, dayEnd).consumption[0].y, 0)).toBe(true);
  });
  it('Zukunft bleibt leer', () => {
    const last = dayStart + 14 * HOUR_MS;
    const pts = [pt(1, 1, dayStart + HOUR_MS), pt(2, 2, last)];
    const m = powerModel(pts, dayStart, dayEnd);
    expect(Math.max(...m.production.map((p) => p.x))).toBe(last);
    expect(Math.max(...m.consumption.map((p) => p.x))).toBe(last);
  });
});

describe('Zeitachse', () => {
  it('Normaltag', () => {
    const s = Date.parse('2026-10-06T22:00:00Z');
    const e = Date.parse('2026-10-07T22:00:00Z');
    const ticks = timeTicks(s, e);
    expect(ticks).toHaveLength(9);
    expect(ticks.map((v) => timeLabel(v, e))).toEqual(['00:00', '03:00', '06:00', '09:00', '12:00', '15:00', '18:00', '21:00', '24:00']);
  });
  it('Umstellungstag mit 25 Stunden', () => {
    const s = Date.parse('2026-10-24T22:00:00Z');
    const e = Date.parse('2026-10-25T23:00:00Z');
    const ticks = timeTicks(s, e);
    expect(ticks[0]).toBe(s);
    expect(ticks[ticks.length - 1]).toBe(e);
    expect(timeLabel(e, e)).toBe('24:00');
    for (let i = 1; i < ticks.length; i++) expect(ticks[i]).toBeGreaterThan(ticks[i - 1]);
  });
});
