// Task 4.4: the options of the three charts (src/core/chartOptions.ts) and their wiring (src/ui/charts.ts).
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from 'vitest';
import { CHART_GROUP, co2Bands, co2Extent, co2Option, humidityExtent, humidityOption, temperatureOption, type ChartInput, type Palette } from '../src/core/chartOptions';
import { parseAnnotatedCsv } from '../src/core/csv';
import { makeFormat } from '../src/core/format';
import { selectionBounds } from '../src/core/ranges';
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
  points: points24h, selection: { kind: '24h' }, now: NOW, lang: 'de', format: makeFormat(o.lang ?? 'de'), palette, simulated: false, ...o,
});
const pt = (t: number, co2: number | null, temperature: number | null = null, humidity: number | null = null): HistoryPoint => ({ t, co2, temperature, humidity });

const temp = (o?: Partial<ChartInput>) => temperatureOption(input(o)) as any;
const co2 = (o?: Partial<ChartInput>) => co2Option(input(o)) as any;
const hum = (o?: Partial<ChartInput>) => humidityOption(input(o)) as any;

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

describe('CO₂ chart', () => {
  it('one panel with one CO₂ line, ppm axis 400 to 1400 in steps of 200, time labels shown', () => {
    const o = co2();
    expect(o.grid).not.toBeInstanceOf(Array);
    expect(o.series).toHaveLength(1);
    expect(o.series[0]).toMatchObject({ id: 'co2', name: 'CO₂', type: 'line' });
    const { start, end } = selectionBounds({ kind: '24h' }, NOW);
    expect(o.xAxis).toMatchObject({ type: 'time', min: start, max: end });
    expect(o.xAxis.axisLabel.show).toBe(true);
    expect(o.yAxis).toMatchObject({ min: 400, max: 1400, interval: 200 });
    expect(o.graphic[0].style.text).toBe('ppm');
  });
  it('the scale widens when the data goes beyond the usual range', () => {
    expect(co2Extent([])).toEqual({ min: 400, max: 1400 });
    expect(co2Extent([pt(0, 1500)])).toEqual({ min: 400, max: 1600 });
    expect(co2Extent([pt(0, 350)])).toEqual({ min: 200, max: 1400 });
    expect(co2({ points: [pt(0, 1500, 21, 75)] }).yAxis).toMatchObject({ min: 400, max: 1600 });
  });
});

describe('humidity chart', () => {
  it('one panel with one muted humidity line, % axis 20 to 60 in steps of 20, time labels shown', () => {
    const o = hum();
    expect(o.series).toHaveLength(1);
    expect(o.series[0]).toMatchObject({ id: 'humidity', name: 'Luftfeuchte', type: 'line' });
    expect(o.series[0].lineStyle.color).toBe('#hum');
    expect(o.xAxis.axisLabel.show).toBe(true);
    expect(o.yAxis).toMatchObject({ min: 20, max: 60, interval: 20 });
    expect(o.graphic[0].style.text).toBe('%');
  });
  it('the scale widens when the data goes beyond the usual range', () => {
    expect(humidityExtent([])).toEqual({ min: 20, max: 60 });
    expect(humidityExtent([pt(0, null, null, 75), pt(1, null, null, 12)])).toEqual({ min: 0, max: 80 });
    expect(hum({ points: [pt(0, 1500, 21, 75)] }).yAxis).toMatchObject({ min: 20, max: 80 });
  });
  it('has no bands or limit lines', () => {
    expect(hum().series[0].markArea).toBeUndefined();
    expect(hum().series[0].markLine).toBeUndefined();
  });
});

describe('lamp bands', () => {
  it('the CO₂ chart marks below 800, 800 to 1000 and above 1000 ppm in the colours of the lamps', () => {
    const s = co2().series[0];
    const bands = s.markArea.data as any[][];
    expect(bands.map((b) => [b[0].yAxis, b[1].yAxis, b[0].itemStyle.color])).toEqual([
      [400, 800, '#good'],
      [800, 1000, '#soon'],
      [1000, 1400, '#bad'],
    ]);
    expect(s.markArea.silent).toBe(true);
    expect(s.markLine.data).toEqual([{ yAxis: 800 }, { yAxis: 1000 }]);
  });
  it('the bands follow the scale when it is widened', () => {
    const o = co2({ points: [pt(0, 1500, 21, 40)] });
    expect((o.series[0].markArea.data as any[][]).at(-1)!.map((e) => e.yAxis)).toEqual([1000, 1600]);
    expect(co2Bands({ min: 200, max: 1400 }, palette)[0].map((e: any) => e.yAxis)).toEqual([200, 800]);
  });
});

describe('linked pointer', () => {
  it('every chart shows the value of its own line at the pointed time (axis tooltip, line pointer)', () => {
    for (const o of [co2(), temp(), hum()]) {
      expect(o.tooltip.trigger).toBe('axis');
      expect(o.tooltip.axisPointer.type).toBe('line');
      expect(o.series).toHaveLength(1);
    }
  });
  it('the three charts join one group, which echarts.connect links, and get their option on render', () => {
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
    const charts = createCharts(api, {} as HTMLElement, {} as HTMLElement, {} as HTMLElement);
    expect(made.map((m) => m.group)).toEqual([CHART_GROUP, CHART_GROUP, CHART_GROUP]);
    expect(connected).toEqual([CHART_GROUP]);
    charts.render(input());
    expect(made.map((m) => (m.options[0] as any).series[0].id)).toEqual(['co2', 'temperature', 'humidity']);
  });
  it('resize and dispose reach all three charts', () => {
    const n = { resize: 0, dispose: 0 };
    const api: EchartsApi = {
      init: () => ({ group: '', setOption: () => {}, resize: () => void n.resize++, dispose: () => void n.dispose++ }),
      connect: () => {},
    };
    const charts = createCharts(api, {} as HTMLElement, {} as HTMLElement, {} as HTMLElement);
    charts.resize();
    charts.dispose();
    expect(n).toEqual({ resize: 3, dispose: 3 });
  });
  it('rendering again replaces the options instead of merging (no stale series after a range change)', () => {
    const calls: boolean[] = [];
    const api: EchartsApi = {
      init: () => ({ group: '', setOption: (_o, notMerge) => void calls.push(notMerge === true), resize: () => {}, dispose: () => {} }),
      connect: () => {},
    };
    createCharts(api, {} as HTMLElement, {} as HTMLElement, {} as HTMLElement).render(input());
    expect(calls).toEqual([true, true, true]);
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
  it('all charts use the time range for their axis: 24 hours ending now', () => {
    const { start, end } = selectionBounds({ kind: '24h' }, NOW);
    expect(end - start).toBe(24 * 3_600_000);
    expect([temp().xAxis.min, temp().xAxis.max]).toEqual([start, end]);
    expect([co2().xAxis.min, co2().xAxis.max]).toEqual([start, end]);
    expect([hum().xAxis.min, hum().xAxis.max]).toEqual([start, end]);
  });
  it('7 days ending now, labelled with weekday and day', () => {
    const { start, end } = selectionBounds({ kind: '7d' }, NOW);
    expect(end - start).toBe(7 * 24 * 3_600_000);
    const t = temp({ selection: { kind: '7d' }, points: points7d });
    expect([t.xAxis.min, t.xAxis.max]).toEqual([start, end]);
    expect(t.xAxis.axisLabel.formatter(Date.parse('2026-10-30T12:00:00Z'))).toBe('Fr., 30.');
    expect(temp().xAxis.axisLabel.formatter(Date.parse('2026-11-03T05:30:00Z'))).toBe('06:30');
    expect(hum({ selection: { kind: '7d' }, points: points7d }).xAxis.axisLabel.formatter(Date.parse('2026-10-30T12:00:00Z'))).toBe('Fr., 30.');
    expect(co2({ selection: { kind: '7d' }, points: points7d }).xAxis.max).toBe(end);
  });
  it('the axis labels use the school time (Europe/Vienna) and the language', () => {
    expect(temp().xAxis.axisLabel.formatter(Date.parse('2026-10-23T08:41:00Z'))).toBe('10:41'); // summer time
    expect(temp({ lang: 'en', selection: { kind: '7d' }, points: points7d }).xAxis.axisLabel.formatter(Date.parse('2026-10-30T12:00:00Z'))).toBe('Fri 30');
  });
});

describe('dashed lines for simulated readings', () => {
  const styles = (o: any) => o.series.map((s: any) => s.lineStyle.type);
  it('measured readings are solid', () => {
    expect(styles(temp())).toEqual(['solid']);
    expect(styles(co2())).toEqual(['solid']);
    expect(styles(hum())).toEqual(['solid']);
  });
  it('simulated readings: every line is dashed', () => {
    expect(styles(temp({ simulated: true }))).toEqual(['dashed']);
    expect(styles(co2({ simulated: true }))).toEqual(['dashed']);
    expect(styles(hum({ simulated: true }))).toEqual(['dashed']);
  });
});

describe('gaps', () => {
  it('a window without readings is null in the data and the line is not connected through it', () => {
    for (const o of [temp(), co2(), hum()]) for (const s of o.series) expect(s.connectNulls).toBe(false);
    const gapStart = Date.parse('2026-11-03T01:45:00Z');
    const gapEnd = Date.parse('2026-11-03T02:35:00Z'); // 2:45 to 3:35 Vienna
    for (const [series, key] of [[temp().series[0], 'temperature'], [co2().series[0], 'co2'], [hum().series[0], 'humidity']] as const) {
      const inGap = (series.data as [number, number | null][]).filter(([t]) => t >= gapStart && t <= gapEnd);
      expect(inGap).toHaveLength(11);
      expect(inGap.every(([, v]) => v === null), key).toBe(true);
    }
  });
  it('no zero is ever invented for a missing value', () => {
    const points = [pt(1, 600, 21, 40), pt(2, null, null, null), pt(3, 610, 21, 41)];
    expect(co2({ points }).series[0].data).toEqual([[1, 600], [2, null], [3, 610]]);
    expect(hum({ points }).series[0].data).toEqual([[1, 40], [2, null], [3, 41]]);
    expect(temp({ points: [pt(2, null, null, null)] }).series[0].data).toEqual([[2, null]]);
  });
  it('the gap of the seven-day recording is null in every series', () => {
    const gap = (points7d.filter((p) => p.t === Date.parse('2026-11-03T02:30:00Z')));
    expect(gap).toEqual([{ t: Date.parse('2026-11-03T02:30:00Z'), co2: null, temperature: null, humidity: null }]);
    const s = co2({ selection: { kind: '7d' }, points: points7d }).series[0].data as [number, number | null][];
    expect(s.find(([t]) => t === gap[0].t)![1]).toBeNull();
    expect(s.some(([, v]) => v === 0)).toBe(false);
  });
});
