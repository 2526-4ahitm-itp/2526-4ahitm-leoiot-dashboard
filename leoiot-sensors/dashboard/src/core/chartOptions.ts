// ECharts options for the two charts, as plain objects built from data and a palette: the
// temperature chart (one panel) and the CO2/humidity chart (two panels on one shared time axis).
// Pure functions, so tests can check bands, gaps and line styles without a browser.
import type { Format } from './format';
import type { Lang } from './i18n';
import { texts } from './i18n';
import { LIMIT_BAD, LIMIT_SOON } from './air';
import { rangeBounds, type RangeId } from './ranges';
import type { HistoryPoint } from './snapshot';

/** The charts share this group, so that one pointer runs through all three panels (`echarts.connect`). */
export const CHART_GROUP = 'room-climate';

/** Colours read from the page's CSS variables, so that the theme decides them. */
export interface Palette {
  font: string;
  ink: string;
  ink3: string;
  line: string;
  lineStrong: string;
  panel: string;
  humidity: string;
  bandGood: string;
  bandSoon: string;
  bandBad: string;
}

export interface ChartInput {
  points: readonly HistoryPoint[];
  range: RangeId;
  /** The time the range ends (now at the last refresh). */
  now: number;
  lang: Lang;
  format: Format;
  palette: Palette;
  /** Readings carry the source `simulated`: every line is dashed. */
  simulated: boolean;
}

type Opt = Record<string, unknown>;

function maxOf(points: readonly HistoryPoint[], key: 'co2' | 'humidity' | 'temperature'): number | null {
  let max: number | null = null;
  for (const p of points) {
    const v = p[key];
    if (v !== null && (max === null || v > max)) max = v;
  }
  return max;
}

function minOf(points: readonly HistoryPoint[], key: 'co2' | 'humidity' | 'temperature'): number | null {
  let min: number | null = null;
  for (const p of points) {
    const v = p[key];
    if (v !== null && (min === null || v < min)) min = v;
  }
  return min;
}

/** CO2 axis: at least 400 to 1400 ppm, in steps of 200, widened when the data goes beyond. */
export function co2Extent(points: readonly HistoryPoint[]): { min: number; max: number } {
  const lo = minOf(points, 'co2');
  const hi = maxOf(points, 'co2');
  return {
    min: lo === null ? 400 : Math.min(400, Math.floor(lo / 200) * 200),
    max: hi === null ? 1400 : Math.max(1400, Math.ceil((hi + 50) / 200) * 200),
  };
}

/** Humidity axis: at least 20 to 60 %, in steps of 20. */
export function humidityExtent(points: readonly HistoryPoint[]): { min: number; max: number } {
  const lo = minOf(points, 'humidity');
  const hi = maxOf(points, 'humidity');
  return {
    min: lo === null ? 20 : Math.min(20, Math.floor(lo / 20) * 20),
    max: hi === null ? 60 : Math.max(60, Math.ceil(hi / 20) * 20),
  };
}

function timeAxis(i: ChartInput, gridIndex: number, showLabels: boolean): Opt {
  const { start, end } = rangeBounds(i.range, i.now);
  const { palette: p, format } = i;
  return {
    type: 'time',
    gridIndex,
    min: start,
    max: end,
    axisLine: { lineStyle: { color: p.line } },
    axisTick: { show: false },
    splitLine: { show: false },
    axisLabel: {
      show: showLabels,
      color: p.ink3,
      fontFamily: p.font,
      hideOverlap: true,
      formatter: (v: number) => (i.range === '24h' ? format.time(v) : format.weekdayDay(v)),
    },
    axisPointer: { label: { show: false } },
  };
}

function valueAxis(i: ChartInput, extra: Opt): Opt {
  const { palette: p, format } = i;
  return {
    type: 'value',
    axisLine: { show: false },
    axisTick: { show: false },
    splitLine: { lineStyle: { color: p.line } },
    axisLabel: { color: p.ink3, fontFamily: p.font, formatter: (v: number) => format.number(v, 0) },
    ...extra,
  };
}

type SeriesKey = 'temperature' | 'co2' | 'humidity';
const UNITS: Record<SeriesKey, { unit: string; decimals: number }> = {
  temperature: { unit: '°C', decimals: 1 },
  co2: { unit: 'ppm', decimals: 0 },
  humidity: { unit: '%', decimals: 0 },
};

function tooltip(i: ChartInput): Opt {
  const { palette: p, format } = i;
  return {
    trigger: 'axis',
    backgroundColor: p.panel,
    borderColor: p.line,
    textStyle: { color: p.ink, fontFamily: p.font },
    axisPointer: { type: 'line', lineStyle: { color: p.ink3 } },
    formatter: (params: { value: [number, number | null]; seriesName: string; seriesId: string }[]) => {
      const rows = params
        .map((s) => {
          const u = UNITS[s.seriesId as SeriesKey];
          const v = s.value[1];
          return `<br>${s.seriesName}: <b>${v === null ? texts(i.lang).unknown : format.number(v, u.decimals)}</b> ${v === null ? '' : u.unit}`;
        })
        .join('');
      return format.dayTime(params[0].value[0]) + rows;
    },
  };
}

function line(i: ChartInput, key: SeriesKey, name: string, color: string, extra: Opt = {}): Opt {
  return {
    id: key,
    name,
    type: 'line',
    showSymbol: false,
    connectNulls: false, // a window without readings is a gap, never a line through it
    data: i.points.map((p) => [p.t, p[key]]),
    lineStyle: { color, width: 2.2, type: i.simulated ? 'dashed' : 'solid' },
    itemStyle: { color },
    emphasis: { disabled: true },
    ...extra,
  };
}

export function temperatureOption(i: ChartInput): Opt {
  const t = texts(i.lang);
  const { palette: p } = i;
  return {
    animationDuration: 300,
    textStyle: { fontFamily: p.font },
    grid: { left: 40, right: 12, top: 16, bottom: 28 },
    tooltip: tooltip(i),
    xAxis: timeAxis(i, 0, true),
    yAxis: valueAxis(i, { scale: true, minInterval: 1 }),
    series: [line(i, 'temperature', t.temperature, p.ink)],
  };
}

/** The lamp bands of the CO2 panel as markArea pairs: below 800, 800 to 1000, above 1000 ppm. */
export function co2Bands(extent: { min: number; max: number }, p: Palette): Opt[][] {
  const band = (from: number, to: number, color: string): Opt[] => [{ yAxis: from, itemStyle: { color } }, { yAxis: to }];
  return [band(extent.min, LIMIT_SOON, p.bandGood), band(LIMIT_SOON, LIMIT_BAD, p.bandSoon), band(LIMIT_BAD, extent.max, p.bandBad)];
}

export function airOption(i: ChartInput): Opt {
  const t = texts(i.lang);
  const { palette: p } = i;
  const co2 = co2Extent(i.points);
  const hum = humidityExtent(i.points);
  return {
    animationDuration: 300,
    textStyle: { fontFamily: p.font },
    tooltip: tooltip(i),
    axisPointer: { link: [{ xAxisIndex: 'all' }] },
    grid: [
      { left: 48, right: 12, top: 26, height: '50%' },
      { left: 48, right: 12, top: '70%', bottom: 28 },
    ],
    xAxis: [timeAxis(i, 0, false), timeAxis(i, 1, true)],
    yAxis: [
      valueAxis(i, { gridIndex: 0, min: co2.min, max: co2.max, interval: 200 }),
      valueAxis(i, { gridIndex: 1, min: hum.min, max: hum.max, interval: 20 }),
    ],
    series: [
      line(i, 'co2', t.co2, p.ink, {
        xAxisIndex: 0,
        yAxisIndex: 0,
        markArea: { silent: true, data: co2Bands(co2, p) },
        markLine: {
          silent: true,
          symbol: 'none',
          label: { show: false },
          lineStyle: { color: p.lineStrong, type: [3, 4], width: 1 },
          data: [{ yAxis: LIMIT_SOON }, { yAxis: LIMIT_BAD }],
        },
      }),
      line(i, 'humidity', t.humidity, p.humidity, { xAxisIndex: 1, yAxisIndex: 1 }),
    ],
    graphic: [
      { type: 'text', left: 4, top: 0, style: { text: 'ppm', fill: p.ink3, font: `12px ${p.font}` } },
      { type: 'text', left: 4, top: '66%', style: { text: '%', fill: p.ink3, font: `12px ${p.font}` } },
    ],
  };
}
