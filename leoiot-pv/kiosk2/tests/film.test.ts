import { describe, expect, it } from 'vitest';
import { buildYear } from '../src/core/yearData';
import { LOOP, T, film, hiddenPeak, schedule } from '../src/core/film';
import { fixtureSchedule, inputOf, syntheticPoints } from './helpers';

const step = 0.05;
const loop = (s: ReturnType<typeof schedule>) => Array.from({ length: Math.round(LOOP / step) }, (_, i) => film(s, i * step));

// Wie lange etwas am Stück sichtbar ist
function spans(states: ReturnType<typeof loop>, on: (st: (typeof states)[number]) => string | null): [string, number][] {
  const out: [string, number][] = [];
  let cur: string | null = null, from = 0;
  states.forEach((st, i) => {
    const v = on(st);
    if (v !== cur) { if (cur !== null) out.push([cur, (i - from) * step]); cur = v; from = i; }
  });
  if (cur !== null) out.push([cur, (states.length - from) * step]);
  return out;
}

describe('Ablauf des Films', () => {
  it('dauert für 365, 200 und 30 Tage gleich lang und endet heute', () => {
    for (const n of [365, 200, 30]) {
      const s = schedule(inputOf(buildYear(syntheticPoints('2025-01-01', n, (i) => 5 + (i % 17)), '2025-01-01', '2026-12-31')));
      expect(LOOP).toBeGreaterThanOrEqual(90);
      expect(LOOP).toBeLessThanOrEqual(110);
      expect(film(s, T.today).day).toBeCloseTo(s.end, 5);
      // die Stelle im Jahr wächst bis heute nie zurück
      let prev = -1;
      for (let t = 0; t < T.today; t += 0.1) { const d = film(s, t).day; expect(d).toBeGreaterThanOrEqual(prev - 1e-9); prev = d; }
    }
  });

  it('hat keine Naht: kurz vor und kurz nach dem Neustart steht kein Grat', () => {
    const s = fixtureSchedule();
    const a = film(s, LOOP - 0.1), b = film(s, 0.1);
    expect(Math.floor(a.day)).toBe(0);
    expect(Math.floor(b.day)).toBe(0);
    // ein Grat ist erst sichtbar, wenn er gewachsen ist: davor liegt nichts
    expect(a.day).toBeLessThan(0.1);
    expect(b.day).toBeLessThan(0.1);
    expect(a.cam.pos[1]).toBeCloseTo(b.cam.pos[1], 0);
  });

  it('zeigt keinen Lichtpunkt, wenn mehr als zwei Tage pro Sekunde vergehen', () => {
    const s = fixtureSchedule();
    for (let t = 0.05; t < T.today; t += 0.05) {
      const speed = Math.abs(film(s, t + 0.05).day - film(s, t - 0.05).day) / 0.1;
      if (speed > 2.2) expect(film(s, t).pen).toBeNull();
    }
  });

  it('zeigt jeden Text lange genug', () => {
    const states = loop(fixtureSchedule());
    const check = (name: string, list: [string, number][], min: number) => {
      for (const [, d] of list) expect(d, name).toBeGreaterThanOrEqual(min);
    };
    check('Tageswert', spans(states, (st) => (st.tag ? String(st.tag.row) : null)), 1.5);
    check('Meilenstein', spans(states, (st) => (st.mile ? String(st.mile.kwh) : null)), 2);
    check('Bester Tag', spans(states, (st) => (st.best?.on ? 'b' : null)), 1.5);
    check('Lücke', spans(states, (st) => (st.gap ? String(st.gap.from) : null)), 1.5);
    const moments = spans(states, (st) => st.moment);
    for (const [k, d] of moments) expect(d, k).toBeGreaterThanOrEqual(k === 'tail' ? 3 : 6);
    expect(moments.map(([k]) => k)).toEqual(['live', 'total', 'co2', 'tail']);
    for (const label of new Set(states.flatMap((st) => st.months.map((m) => m.label)))) {
      const vis = states.filter((st) => st.months.some((m) => m.label === label && m.alpha > 0.25)).length * step;
      expect(vis, label).toBeGreaterThanOrEqual(2);
      expect(vis, label).toBeLessThanOrEqual(3);
    }
  });

  it('beschriftet keinen Gipfel, den ein näherer Grat verdeckt, und den besten Tag erst ausgewachsen', () => {
    const s = fixtureSchedule();
    for (const st of loop(s)) {
      if (st.tag) expect(hiddenPeak(s, st.tag.row, st.day)).toBe(false);
      if (st.best?.on) expect(st.best.h).toBeGreaterThan(s.peaks[s.input.best].h * 0.98);
    }
  });

  it('zeichnet den ersten Tag mit dem Lichtpunkt von links nach rechts', () => {
    const s = fixtureSchedule();
    const p1 = film(s, 1).pen!, p2 = film(s, 3).pen!;
    expect(p1.row).toBe(0);
    expect(p2.u).toBeGreaterThan(p1.u);
    expect(film(s, 2).axisOn).toBe(true);
  });

  it('nennt den besten Tag und die Lücke im Spätsommer', () => {
    const s = fixtureSchedule();
    const states = loop(s);
    expect(states.some((st) => st.best?.on)).toBe(true);
    expect(states.some((st) => st.gap !== null)).toBe(true);
    expect(s.miles.length).toBeGreaterThan(0);
  });

  it('lässt nichts öfter als dreimal pro Sekunde aufblinken', () => {
    const states = loop(fixtureSchedule());
    const flags: ((st: (typeof states)[number]) => boolean)[] = [(st) => !!st.pen?.on, (st) => st.tag !== null, (st) => st.mile !== null, (st) => !!st.best?.on, (st) => st.gap !== null, (st) => st.moment !== null];
    for (const f of flags) {
      const changes = states.map((st, i) => (i > 0 && f(st) !== f(states[i - 1]) ? i * step : -1)).filter((x) => x >= 0);
      for (let i = 0; i + 6 < changes.length; i++) expect(changes[i + 6] - changes[i]).toBeGreaterThan(1); // 3 mal an und aus
    }
  });
});
