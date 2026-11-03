// Task 4.4: the options of the two charts (src/core/chartOptions.ts) and their wiring (src/ui/charts.ts).
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from 'vitest';
import { airOption, CHART_GROUP, co2Bands, co2Extent, humidityExtent, temperatureOption, type ChartInput, type Palette } from '../src/core/chartOptions';
import { parseAnnotatedCsv } from '../src/core/csv';
import { makeFormat } from '../src/core/format';
import { rangeBounds } from '../src/core/ranges';
import { parseHistory, type HistoryPoint } from '../src/core/snapshot';
import { createCharts, type ChartInstance, type EchartsApi } from '../src/ui/charts';
import { fixture } from './helpers';

const palette: Palette = {
  font: 'Lexend', ink: '#ink', ink3: '#ink3', line: '#line', lineStrong: '#strong', panel: '#panel',
  humidity: '#hum', bandGood: '#good', bandSoon: '#soon', bandBad: '#bad',
};
const NOW = Date.parse('2026-11-03T06:36:39Z');
const points24h = parseHistory(parseAnnotatedCsv(fixture('history24h.csv')));
const points7d = parseHistory(parseAnnotatedCsv(fixture('history7d.csv')));
const input = (o: Partial<ChartInput> = {}): ChartInput => ({
  points: points24h, range: '24h', now: NOW, lang: 'de', format: makeFormat(o.lang ?? 'de'), palette, simulated: false, ...o,
});
const pt = (t: number, co2: number | null, temperature: number | null = null, humidity: number | null = null): HistoryPoint => ({ t, co2, temperature, humidity });

const temp = (o?: Partial<ChartInput>) => temperatureOption(input(o)) as any;
const air = (o?: Partial<ChartInput>) => airOption(input(o)) as any;

describe('temperature chart', () => {
  it('one panel with one temperature line', () => {
    const o = temp();
    expect(o.series).toHaveLength(1);
    expect(o.series[0]).toMatchObject({ id: 'temperature', name: 'Temperatur', type: 'line' });
    expect(o.xAxis.type).toBe('time');
    expect(o.yAxis.type).toBe('value');
    expect(o.series[0].data).toHaveLength(points24h.length);
    expect(o.series[0].data[points24h.length - 1]).toEqual([points24h.at(-1)!.t, points24h.at(-1)!.temperature]);
  });
  it('English names', () => {
    expect(temp({ lang: 'en' }).series[0].name).toBe('Temperature');
  });
});

describe('CO₂/humidity chart', () => {
  it('two panels (grids) with their own scales on one shared time axis', () => {
    const o = air();
    expect(o.grid).toHaveLength(2);
    expect(o.xAxis).toHaveLength(2);
    expect(o.yAxis).toHaveLength(2);
    const { start, end } = rangeBounds('24h', NOW);
    for (const x of o.xAxis) expect(x).toMatchObject({ type: 'time', min: start, max: end });
    expect(o.xAxis.map((x: any) => x.gridIndex)).toEqual([0, 1]);
    expect(o.yAxis.map((y: any) => y.gridIndex)).toEqual([0, 1]);
    expect(o.yAxis[0]).toMatchObject({ min: 400, max: 1400, interval: 200 }); // ppm
    expect(o.yAxis[1]).toMatchObject({ min: 20, max: 60, interval: 20 }); // %
    expect(o.series.map((s: any) => [s.id, s.xAxisIndex, s.yAxisIndex])).toEqual([['co2', 0, 0], ['humidity', 1, 1]]);
  });
  it('the time labels are written once, under the lower panel', () => {
    const o = air();
    expect(o.xAxis.map((x: any) => x.axisLabel.show)).toEqual([false, true]);
  });
  it('the scales widen when the data goes beyond the usual range', () => {
    expect(co2Extent([])).toEqual({ min: 400, max: 1400 });
    expect(co2Extent([pt(0, 1500)])).toEqual({ min: 400, max: 1600 });
    expect(co2Extent([pt(0, 350)])).toEqual({ min: 200, max: 1400 });
    expect(humidityExtent([])).toEqual({ min: 20, max: 60 });
    expect(humidityExtent([pt(0, null, null, 75), pt(1, null, null, 12)])).toEqual({ min: 0, max: 80 });
    const o = air({ points: [pt(0, 1500, 21, 75)] });
    expect(o.yAxis[0]).toMatchObject({ min: 400, max: 1600 });
    expect(o.yAxis[1]).toMatchObject({ min: 20, max: 80 });
  });
});

describe('lamp bands', () => {
  it('the CO₂ panel marks below 800, 800 to 1000 and above 1000 ppm in the colours of the lamps', () => {
    const o = air();
    const co2 = o.series[0];
    const bands = co2.markArea.data as any[][];
    expect(bands.map((b) => [b[0].yAxis, b[1].yAxis, b[0].itemStyle.color])).toEqual([
      [400, 800, '#good'],
      [800, 1000, '#soon'],
      [1000, 1400, '#bad'],
    ]);
    expect(co2.markArea.silent).toBe(true);
    expect(co2.markLine.data).toEqual([{ yAxis: 800 }, { yAxis: 1000 }]);
  });
  it('the bands follow the scale when it is widened', () => {
    const o = air({ points: [pt(0, 1500, 21, 40)] });
    expect((o.series[0].markArea.data as any[][]).at(-1)!.map((e) => e.yAxis)).toEqual([1000, 1600]);
    expect(co2Bands({ min: 200, max: 1400 }, palette)[0].map((e: any) => e.yAxis)).toEqual([200, 800]);
  });
  it('humidity has no bands', () => {
    const o = air();
    expect(o.series[1].markArea).toBeUndefined();
    expect(o.series[1].markLine).toBeUndefined();
  });
});

describe('linked pointer', () => {
  it('the air chart links the pointer of both panels (all its time axes)', () => {
    expect(air().axisPointer.link).toEqual([{ xAxisIndex: 'all' }]);
  });
  it('every panel shows the values of all lines at the pointed time (axis tooltip, line pointer)', () => {
    for (const o of [temp(), air()]) {
      expect(o.tooltip.trigger).toBe('axis');
      expect(o.tooltip.axisPointer.type).toBe('line');
      expect(o.xAxis).toBeDefined();
    }
  });
  it('the three panels join one group, which echarts.connect links', () => {
    const made: { group: string; options: unknown[] }[] = [];
    const connected: string[] = [];
    const api: EchartsApi = {
      init: () => {
        const rec = { group: '', options: [] as unknown[] };
        made.push(rec);
        return { get group() { return rec.group; }, set group(g: string) { rec.group = g; }, setOption: (o) => void rec.options.push(o), resize: () => {}, dispose: () => {} } as ChartInstance;
      },
      connect: (g) => void connected.push(g),
    };
    const charts = createCharts(api, {} as HTMLElement, {} as HTMLElement);
    expect(made.map((m) => m.group)).toEqual([CHART_GROUP, CHART_GROUP]);
    expect(connected).toEqual([CHART_GROUP]);
    charts.render(input());
    const [t, a] = made.map((m) => m.options[0] as any);
    // together: 1 time axis in the temperature chart + 2 in the air chart = the three panels
    expect([t.xAxis, ...a.xAxis]).toHaveLength(3);
    expect(t.tooltip.trigger).toBe(a.tooltip.trigger);
  });
  it('rendering again replaces the options instead of merging (no stale series after a range change)', () => {
    const calls: boolean[] = [];
    const api: EchartsApi = {
      init: () => ({ group: '', setOption: (_o, notMerge) => void calls.push(notMerge === true), resize: () => {}, dispose: () => {} }),
      connect: () => {},
    };
    createCharts(api, {} as HTMLElement, {} as HTMLElement).render(input());
    expect(calls).toEqual([true, true]);
  });
  it('the tooltip names the time and the values, an empty time as a dash and never as zero', () => {
    const f = temp().tooltip.formatter as (p: unknown[]) => string;
    const t = Date.parse('2026-11-03T05:30:00Z'); // 06:30 Vienna
    const withValue = f([{ value: [t, 21.46], seriesName: 'Temperatur', seriesId: 'temperature' }]);
    expect(withValue).toContain('3.11., 06:30');
    expect(withValue).toContain('Temperatur: <b>21,5</b> °C');
    const empty = f([{ value: [t, null], seriesName: 'CO₂', seriesId: 'co2' }]);
    expect(empty).toContain('CO₂: <b>–</b>');
    expect(empty).not.toMatch(/\b0\b/);
  });
});

describe('stated range', () => {
  it('both charts use the time range for their axis: 24 hours ending now', () => {
    const { start, end } = rangeBounds('24h', NOW);
    expect(end - start).toBe(24 * 3_600_000);
    expect([temp().xAxis.min, temp().xAxis.max]).toEqual([start, end]);
    expect(air().xAxis.map((x: any) => [x.min, x.max])).toEqual([[start, end], [start, end]]);
  });
  it('7 days ending now, labelled with weekday and day', () => {
    const { start, end } = rangeBounds('7d', NOW);
    expect(end - start).toBe(7 * 24 * 3_600_000);
    const t = temp({ range: '7d', points: points7d });
    expect([t.xAxis.min, t.xAxis.max]).toEqual([start, end]);
    expect(t.xAxis.axisLabel.formatter(Date.parse('2026-10-30T12:00:00Z'))).toBe('Fr., 30.');
    expect(temp().xAxis.axisLabel.formatter(Date.parse('2026-11-03T05:30:00Z'))).toBe('06:30');
    expect(air({ range: '7d', points: points7d }).xAxis.map((x: any) => x.max)).toEqual([end, end]);
  });
  it('the axis labels use the school time (Europe/Vienna) and the language', () => {
    expect(temp().xAxis.axisLabel.formatter(Date.parse('2026-10-23T08:41:00Z'))).toBe('10:41'); // summer time
    expect(temp({ lang: 'en', range: '7d', points: points7d }).xAxis.axisLabel.formatter(Date.parse('2026-10-30T12:00:00Z'))).toBe('Fri 30');
  });
});

describe('dashed lines for simulated readings', () => {
  const styles = (o: any) => o.series.map((s: any) => s.lineStyle.type);
  it('measured readings are solid', () => {
    expect(styles(temp())).toEqual(['solid']);
    expect(styles(air())).toEqual(['solid', 'solid']);
  });
  it('simulated readings: every line is dashed', () => {
    expect(styles(temp({ simulated: true }))).toEqual(['dashed']);
    expect(styles(air({ simulated: true }))).toEqual(['dashed', 'dashed']);
  });
});

describe('gaps', () => {
  it('a window without readings is null in the data and the line is not connected through it', () => {
    for (const o of [temp(), air()]) for (const s of o.series) expect(s.connectNulls).toBe(false);
    const gapStart = Date.parse('2026-11-03T01:45:00Z');
    const gapEnd = Date.parse('2026-11-03T02:35:00Z'); // 2:45 to 3:35 Vienna
    for (const [series, key] of [[temp().series[0], 'temperature'], [air().series[0], 'co2'], [air().series[1], 'humidity']] as const) {
      const inGap = (series.data as [number, number | null][]).filter(([t]) => t >= gapStart && t <= gapEnd);
      expect(inGap).toHaveLength(11);
      expect(inGap.every(([, v]) => v === null), key).toBe(true);
    }
  });
  it('no zero is ever invented for a missing value', () => {
    const o = air({ points: [pt(1, 600, 21, 40), pt(2, null, null, null), pt(3, 610, 21, 41)] });
    expect(o.series[0].data).toEqual([[1, 600], [2, null], [3, 610]]);
    expect(o.series[1].data).toEqual([[1, 40], [2, null], [3, 41]]);
    expect(temp({ points: [pt(2, null, null, null)] }).series[0].data).toEqual([[2, null]]);
  });
  it('the gap of the seven-day recording is null in every series', () => {
    const gap = (points7d.filter((p) => p.t === Date.parse('2026-11-03T02:30:00Z')));
    expect(gap).toEqual([{ t: Date.parse('2026-11-03T02:30:00Z'), co2: null, temperature: null, humidity: null }]);
    const s = air({ range: '7d', points: points7d }).series[0].data as [number, number | null][];
    expect(s.find(([t]) => t === gap[0].t)![1]).toBeNull();
    expect(s.some(([, v]) => v === 0)).toBe(false);
  });
});
