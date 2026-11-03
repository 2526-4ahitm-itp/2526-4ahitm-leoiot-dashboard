import { describe, expect, it } from 'vitest';
import { buildYear, COLS, FIRST_MINUTE, WINDOW_MIN, type YieldPoint } from '../src/core/yearData';
import { fixtureYear, syntheticPoints } from './helpers';

const colOf = (hh: number, mm: number) => Math.round((hh * 60 + mm - FIRST_MINUTE) / WINDOW_MIN);

describe('Landschaft aus den Messwerten', () => {
  it('liest das echte Jahr: Tage, Lücke im Spätsommer, bester Tag', () => {
    const y = fixtureYear();
    expect(y.days[0].key).toBe('2026-04-21'); // davor keine Tageskurve (am 20.04. nur zwei Stände)
    expect(y.days.at(-1)!.key).toBe('2026-11-03');
    const gap = y.days.filter((d) => d.energy === null).map((d) => d.key);
    expect(gap[0]).toBe('2026-08-10');
    expect(gap.at(-1)).toBe('2026-09-20');
    expect(gap).toHaveLength(42);
    expect(y.days.find((d) => d.key === '2026-06-30')!.energy).toBeCloseTo(1056.1, 1);
  });

  it('nimmt als Tagesproduktion den höchsten Stand des Tages, wie die anderen PV-Ansichten', () => {
    const y = fixtureYear();
    // Tageswerte der Datenbank (letzter Stand je Wiener Tag) für drei Tage
    expect(y.days.find((d) => d.key === '2026-05-26')!.energy).toBeCloseTo(1010.3, 1);
    expect(y.days.find((d) => d.key === '2026-08-09')!.energy).toBeCloseTo(422.6, 1);
    expect(y.days.find((d) => d.key === '2026-11-02')!.energy).toBeCloseTo(43.6, 1);
  });

  it('ergibt eine glatte Kurve, obwohl die Cloud den Zähler nur alle 20 Minuten fortschreibt', () => {
    const d = fixtureYear().days.find((x) => x.key === '2026-05-26')!;
    const noon = [...d.power.slice(colOf(11, 0), colOf(13, 0))];
    expect(Math.min(...noon)).toBeGreaterThan(90);
    expect(Math.max(...noon) / Math.min(...noon)).toBeLessThan(1.4);
  });

  it('zeigt keinen Knick und keine Spitze, wenn der Zähler kurz zurückspringt', () => {
    const pts = syntheticPoints('2026-06-01', 1, () => 10);
    const ok = buildYear(pts, '2026-06-01', '2026-06-01').days[0].power;
    const i = pts.findIndex((p) => new Date(p.t).toISOString().endsWith('10:00:00.000Z'));
    const stepped: YieldPoint[] = pts.map((p, j) => (j === i ? { ...p, value: p.value - 30 } : p));
    const back = buildYear(stepped, '2026-06-01', '2026-06-01').days[0].power;
    const peak = Math.max(...ok.filter((v) => !Number.isNaN(v)));
    for (let c = 0; c < COLS; c++) if (!Number.isNaN(ok[c])) expect(Math.abs(back[c] - ok[c])).toBeLessThan(peak * 0.01);
  });

  it('lässt einen Tag ohne Messwerte als Lücke, nicht als null', () => {
    const y = buildYear(syntheticPoints('2026-06-01', 5, () => 10, [2]), '2026-06-01', '2026-06-05');
    expect(y.days[2].energy).toBeNull();
    expect([...y.days[2].power].every(Number.isNaN)).toBe(true);
    expect(y.days[3].energy).toBeGreaterThan(0);
  });

  it('zeigt einen halben Tag nur für die Stunden mit Messwerten', () => {
    const cut = Date.parse('2026-06-02T12:00:00+02:00');
    const pts = syntheticPoints('2026-06-01', 2, () => 10).filter((p) => p.t < cut);
    const p = buildYear(pts, '2026-06-01', '2026-06-02').days[1].power;
    expect(Number.isNaN(p[colOf(15, 0)])).toBe(true);
    expect(p[colOf(9, 0)]).toBeGreaterThan(0);
  });

  it('rechnet den Tageswechsel nach Mitternacht dem neuen Tag zu', () => {
    const pts = syntheticPoints('2026-06-01', 2, () => 10);
    const lastOfDay1 = pts.filter((p) => p.t < Date.parse('2026-06-02T00:00:00+02:00')).at(-1)!.value;
    // die ersten Stände des zweiten Tages tragen noch die Summe des ersten
    const late = pts.map((p) => (p.t >= Date.parse('2026-06-02T00:00:00+02:00') && p.t < Date.parse('2026-06-02T00:10:00+02:00') ? { ...p, value: lastOfDay1 } : p));
    const y = buildYear(late, '2026-06-01', '2026-06-02');
    expect(y.days[1].energy).toBeCloseTo(y.days[0].energy!, 1);
  });
});
