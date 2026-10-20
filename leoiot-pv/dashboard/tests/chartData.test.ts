import { describe, it, expect } from 'vitest';
import { slotCount, viennaDayStart } from '@leoiot-pv/shared/time';
import { dayBars, dayModel, hourlyMeans, monthBars } from '../src/core/chartData';
import { dayRows, monthRows } from '../src/core/periods';
import { periodDays } from '../src/core/route';

const MIN = 60_000;

describe('dayModel', () => {
  it('25-Stunden-Tag hat 300 Fenster, Uhrzeit 02:00 kommt zweimal vor, nichts doppelt gezeichnet', () => {
    const key = '2026-10-25';
    const start = viennaDayStart(key).getTime();
    const slots = slotCount(key);
    expect(slots).toBe(300);
    const power = [
      { t: start + 5 * MIN, production: 1, consumption: 2 },
      { t: start + 125 * MIN, production: 3, consumption: 4 }, // 02:05 MESZ
      { t: start + 185 * MIN, production: 5, consumption: 6 }, // 02:05 MEZ
    ];
    const m = dayModel(power, start, slots, start + 24 * 60 * MIN);
    expect(m.labels).toHaveLength(300);
    expect(m.labels[24]).toBe('02:00');
    expect(m.labels[36]).toBe('02:00');
    const prod = m.series[0].data;
    expect(prod.filter((v) => v !== null)).toEqual([1, 3, 5]);
    expect(prod[1]).toBe(1);
  });
  it('null nach dem Jetzt und in Lücken', () => {
    const start = viennaDayStart('2026-10-07').getTime();
    const power = [
      { t: start + 5 * MIN, production: 1, consumption: 1 },
      { t: start + 10 * MIN, production: null, consumption: null },
      { t: start + 15 * MIN, production: 2, consumption: 2 },
      { t: start + 20 * MIN, production: 9, consumption: 9 },
    ];
    const m = dayModel(power, start, 288, start + 16 * MIN);
    expect(m.series[0].data.slice(0, 5)).toEqual([null, 1, null, 2, null]);
  });
  it('ohne Verbrauchswerte nur die Produktionskurve', () => {
    const start = viennaDayStart('2026-04-10').getTime();
    const m = dayModel([{ t: start + 5 * MIN, production: 1, consumption: null }], start, 288, start + 99 * MIN);
    expect(m.series.map((s) => s.key)).toEqual(['prod']);
  });
});

describe('hourlyMeans', () => {
  it('mittelt je Stunde und schneidet die Zukunft ab', () => {
    const start = viennaDayStart('2026-10-07').getTime();
    const power = [
      { t: start + 5 * MIN, production: 2, consumption: 1 },
      { t: start + 10 * MIN, production: 4, consumption: 3 },
      { t: start + 65 * MIN, production: 6, consumption: 5 },
    ];
    const rows = hourlyMeans(dayModel(power, start, 288, start + 70 * MIN));
    expect(rows).toEqual([
      { label: '00:00', values: [3, 2] },
      { label: '01:00', values: [6, 5] },
    ]);
  });
});

describe('Balken', () => {
  const today = '2026-10-07';
  const by = {
    '2026-10-05': { yield: 300, exported: 30, charged: 20, imported: 10, discharged: 5 },
    '2026-10-06': { yield: 280 },
    '2026-10-07': { yield: 100, exported: 10, charged: 5, imported: 5, discharged: 1 },
  };
  it('Woche: Zukunft leer, Lücke leer mit Hinweis, heute als nicht abgeschlossen', () => {
    const rows = dayRows(periodDays('week', '2026-10-05'), by, today);
    const m = dayBars(rows, 'week', 'de');
    expect(m.labels).toEqual(['Mo 5', 'Di 6', 'Mi 7', 'Do 8', 'Fr 9', 'Sa 10', 'So 11']);
    const prod = m.series.find((s) => s.key === 'prod')!.data;
    expect(prod).toEqual([300, 280, 100, null, null, null, null]);
    const imp = m.series.find((s) => s.key === 'imp')!.data;
    expect(imp).toEqual([10, null, 5, null, null, null, null]);
    expect(m.marks[2]).toEqual(['noch nicht abgeschlossen']);
    expect(m.marks[1]).toEqual(['Netz, Batterie und Verbrauch werden erst ab 20. April 2026 erfasst.']);
    const gap = dayBars(dayRows(['2026-10-04'], {}, today), 'week', 'de');
    expect(gap.series[0].data).toEqual([null]);
    expect(gap.marks[0][0]).toContain('keine Daten');
  });
  it('Jahr: Monate nach dem laufenden leer, laufender markiert', () => {
    const rows = dayRows(periodDays('year', '2026-01-01'), by, today);
    const m = monthBars(monthRows(2026, rows, today), 'en');
    const prod = m.series[0].data;
    expect(prod[9]).toBe(680);
    expect(prod[10]).toBeNull();
    expect(prod[11]).toBeNull();
    expect(m.marks[9]).toEqual(['not finished yet']);
    expect(m.labels[0]).toBe('Jan');
  });
});
