import { describe, expect, it } from 'vitest';
import type { DayValues } from '../src/core/energy';
import { weekModel, weekTick } from '../src/panels/weekModel';

const week: DayValues[] = [1, 2, 3, 4, 5, 6, 7].map((d) => ({
  key: `2026-10-0${d}`,
  production: d * 10,
  consumption: d * 5 + 0.5,
  exported: d,
}));
week[2] = { key: '2026-10-03', production: null, consumption: null, exported: null };

describe('weekModel', () => {
  it('beschriftet sieben Tage', () => {
    const m = weekModel(week);
    expect(m.labels).toHaveLength(7);
    expect(m.labels[0]).toBe('01 Okt');
    expect(m.labels[6]).toBe('07 Okt');
  });

  it('liefert die Reihen in fester Reihenfolge', () => {
    const m = weekModel(week);
    expect(m.series.map((s) => s.label)).toEqual(['Produktion', 'Verbrauch', 'Ins Netz']);
    expect(m.series.map((s) => s.source)).toEqual(['pv', 'verbrauch', 'netz']);
  });

  it('lässt fehlende Tage als null', () => {
    for (const s of weekModel(week).series) expect(s.data[2]).toBeNull();
  });

  it('reicht Werte unverändert durch', () => {
    const m = weekModel(week);
    expect(m.series[0].data[3]).toBe(40);
    expect(m.series[1].data[3]).toBe(20.5);
    expect(m.series[2].data[3]).toBe(4);
  });
});

describe('weekTick', () => {
  it('schreibt Achsenwerte deutsch', () => {
    expect(weekTick(1500)).toBe('1500');
    expect(weekTick(12.5)).toBe('12,5');
    expect(weekTick(0)).toBe('0');
    for (const v of [1500, 12.5, 0, 2500, 0.5]) expect(weekTick(v)).not.toContain('.');
  });
});
