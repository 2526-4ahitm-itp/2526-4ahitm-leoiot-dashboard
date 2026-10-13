import { describe, it, expect } from 'vitest';
import { flowModel } from '../src/panels/flowModel';
import { buildView } from '../src/data/view';
import type { KioskState } from '../src/data/store';
import type { Power } from '../src/core/energy';
import { NBSP } from '../src/core/format';

const live = (power: Power) => flowModel({ power, source: 'live' })!;
const avg = (power: Power) => flowModel({ power, source: 'average' })!;

describe('flowModel', () => {
  it('ohne Leistungswerte null', () => {
    expect(flowModel(null)).toBeNull();
  });

  it('Live mit Einspeisung und Laden', () => {
    const m = live({ pv: 96.4, load: 81.2, grid: -3.1, battery: -12.1 });
    expect(m.live).toBe(true);
    expect(m.sourceLabel).toBe('Live');
    expect(m.nodes.map((n) => n.value)).toEqual([
      `96,4${NBSP}kW`,
      `81,2${NBSP}kW`,
      `3,1${NBSP}kW`,
      `12,1${NBSP}kW`,
    ]);
    expect(m.nodes.map((n) => n.word)).toEqual(['erzeugt', 'verbraucht', 'Einspeisung', 'lädt']);
    expect(m.nodes.map((n) => n.toHub)).toEqual([true, false, false, false]);
    expect(m.nodes.every((n) => n.active)).toBe(true);
    expect(m.nodes.some((n) => n.value.includes('-'))).toBe(false);
    expect(m.summary).toContain('Energiefluss, Live: Produktion');
  });

  it('Mittelwert mit Bezug und Entladen', () => {
    const m = avg({ pv: 12, load: 48, grid: 21.6, battery: 14.4 });
    expect(m.sourceLabel).toBe('Ø letzte 10 Min');
    expect(m.live).toBe(false);
    expect(m.nodes.map((n) => n.word)).toEqual(['erzeugt', 'verbraucht', 'Bezug', 'entlädt']);
    expect(m.nodes.map((n) => n.toHub)).toEqual([true, false, true, true]);
  });

  it('Nacht: pv und Batterie ruhen', () => {
    const m = live({ pv: 0, load: 24, grid: 24, battery: 0 });
    const [pv, load, grid, battery] = m.nodes;
    expect(pv.word).toBe('ruht');
    expect(pv.active).toBe(false);
    expect(pv.value).toBe(`0,0${NBSP}kW`);
    expect(battery.word).toBe('ruht');
    expect(battery.active).toBe(false);
    expect(load.active).toBe(true);
    expect(grid.active).toBe(true);
  });

  it('Schwelle', () => {
    const grid = (g: number) => live({ pv: 0, load: 0, grid: g, battery: 0 }).nodes[2];
    expect(grid(0.04).word).toBe('ruht');
    expect(grid(0.05).word).toBe('Bezug');
    expect(grid(-0.05).word).toBe('Einspeisung');
    const bat = live({ pv: 0, load: 0, grid: 0, battery: -0.04 }).nodes[3];
    expect(bat.word).toBe('ruht');
    expect(bat.active).toBe(false);
  });
});

describe('Quelle nach Alter der Live-Werte', () => {
  const now = Date.parse('2026-06-10T12:00:00Z');
  const power: Power = { pv: 5, load: 3, grid: -2, battery: 0 };
  const base = {
    rows: [],
    week: {},
    weekKeys: ['2026-06-04', '2026-06-05', '2026-06-06', '2026-06-07', '2026-06-08', '2026-06-09', '2026-06-10'],
    dayKey: '2026-06-10',
    dayStart: now - 12 * 3600_000,
    dayEnd: now + 12 * 3600_000,
    todayStatus: 'ok',
    weekStatus: 'ok',
    lastDataAt: null,
    liveConnected: true,
  };
  const state = (over: Partial<KioskState>): KioskState => ({ ...base, livePower: null, ...over }) as KioskState;
  const c = (k: number) => ({ yield: 10 * k, exported: 1 * k, imported: 2 * k, charged: 1 * k, discharged: 1 * k });

  it('30 Sekunden alt: Live', () => {
    const v = buildView(state({ livePower: { power, t: now - 30_000 } }), now);
    expect(flowModel(v.flow)?.sourceLabel).toBe('Live');
  });

  it('3 Minuten alt ohne Zählerstände: null', () => {
    const v = buildView(state({ livePower: { power, t: now - 180_000 } }), now);
    expect(flowModel(v.flow)).toBeNull();
  });

  it('3 Minuten alt mit Zählerständen: Mittelwert', () => {
    const rows = [0, 1, 2].map((i) => ({ t: now - 600_000 + i * 300_000, counters: c(1 + i) }));
    const v = buildView(state({ rows, livePower: { power, t: now - 180_000 } }), now);
    expect(flowModel(v.flow)?.sourceLabel).toBe('Ø letzte 10 Min');
  });
});
