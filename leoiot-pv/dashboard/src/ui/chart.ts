// Diagramm mit Chart.js: Tageskurve (Linien) und gruppierte Balken. Farben nur aus den CSS-Variablen.
import {
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  Filler,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
  type ChartDataset,
} from 'chart.js';
import { formatTick } from '@leoiot-pv/shared/format';
import { TEXT, kw, kwh, type Lang } from '../core/i18n';
import type { ChartModel, SeriesKey } from '../core/chartData';
import { QUANTITY_COLOR } from './dom';

Chart.register(BarController, BarElement, CategoryScale, Filler, LineController, LineElement, LinearScale, PointElement, Tooltip);
Chart.defaults.font.family = "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

const SERIES_QUANTITY: Record<SeriesKey, 'production' | 'consumption' | 'fromGrid' | 'toGrid'> = {
  prod: 'production',
  cons: 'consumption',
  imp: 'fromGrid',
  exp: 'toGrid',
};

const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const cssVar = (name: string): string => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

/** '#rrggbb' mit Deckkraft als rgba(). */
function withAlpha(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

// Schraffur für "Ins Netz" in der Farbe der Größe
function hatch(color: string, alpha: number): CanvasPattern | string {
  const c = document.createElement('canvas');
  c.width = c.height = 8;
  const ctx = c.getContext('2d');
  if (!ctx) return withAlpha(color, alpha * 0.5);
  ctx.strokeStyle = withAlpha(color, alpha);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-2, 10);
  ctx.lineTo(10, -2);
  ctx.moveTo(-2, 2);
  ctx.lineTo(2, -2);
  ctx.moveTo(6, 10);
  ctx.lineTo(10, 6);
  ctx.stroke();
  return ctx.createPattern(c, 'repeat') ?? withAlpha(color, alpha * 0.5);
}

export interface ChartOptions {
  /** Klick auf einen Balken: Schlüssel des Tages bzw. Monats */
  onDrill(key: string): void;
}

export interface ChartHandle {
  show(model: ChartModel, lang: Lang, animate: boolean): void;
  highlight(key: string | null): void;
  /** Farben neu lesen (Darstellung gewechselt) */
  recolor(): void;
  destroy(): void;
}

export function createChart(canvas: HTMLCanvasElement, opts: ChartOptions): ChartHandle {
  let chart: Chart | null = null;
  let model: ChartModel | null = null;
  let lang: Lang = 'de';
  let signature = '';
  let marked: string | null = null;
  let armed = -1; // Berührung: erster Tipp zeigt die Werte, der zweite öffnet

  function paint(ds: ChartDataset, key: SeriesKey, alpha: number): void {
    const color = cssVar(QUANTITY_COLOR[key]);
    if (model?.kind === 'line') {
      (ds as ChartDataset<'line'>).borderColor = withAlpha(color, alpha);
      (ds as ChartDataset<'line'>).backgroundColor = withAlpha(color, 0.12 * alpha);
    } else {
      const hatched = key === 'exp';
      ds.backgroundColor = hatched ? hatch(color, alpha) : withAlpha(color, alpha);
      (ds as ChartDataset<'bar'>).borderColor = withAlpha(color, alpha);
      (ds as ChartDataset<'bar'>).borderWidth = hatched ? 1.5 : 0;
    }
  }

  // Immer neue Dataset-Objekte: Chart.js merkt aufgelöste Farben am Objekt
  function datasets(m: ChartModel): ChartDataset[] {
    const L = TEXT[lang];
    const keys = m.series.map((s) => s.key);
    const faded = marked !== null && keys.includes(marked as SeriesKey);
    return m.series.map((s) => {
      const ds =
        m.kind === 'line'
          ? ({ type: 'line', label: L.quantities[SERIES_QUANTITY[s.key]], data: s.data, borderWidth: 2.5, pointRadius: 0, pointHitRadius: 8, fill: s.key === 'prod' ? 'origin' : false, tension: 0.2, spanGaps: false } as ChartDataset)
          : ({ type: 'bar', label: L.quantities[SERIES_QUANTITY[s.key]], data: s.data, borderRadius: 2, barPercentage: 0.92, categoryPercentage: 0.88 } as ChartDataset);
      paint(ds, s.key, faded && marked !== s.key ? 0.25 : 1);
      return ds;
    });
  }

  function build(m: ChartModel, animate: boolean): void {
    chart?.destroy();
    const L = TEXT[lang];
    const ink2 = cssVar('--ink-2');
    const line = cssVar('--line');
    const unit = m.kind === 'line' ? 'kW' : 'kWh';
    chart = new Chart(canvas, {
      type: m.kind === 'line' ? 'line' : 'bar',
      data: { labels: m.labels, datasets: datasets(m) },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: reduced || !animate ? false : { duration: 400 },
        interaction: { mode: 'index', intersect: false },
        onClick(event, elements) {
          const cur = model;
          if (cur?.kind !== 'bar' || elements.length === 0) return;
          const i = elements[0].index;
          const touch = (event.native as PointerEvent | null)?.pointerType === 'touch';
          if (touch && armed !== i) {
            armed = i;
            return;
          }
          armed = -1;
          opts.onDrill(cur.keys[i]);
        },
        onHover(event, elements) {
          const target = event.native?.target as HTMLElement | undefined;
          if (target) target.style.cursor = elements.length > 0 && model?.kind === 'bar' ? 'pointer' : 'default';
        },
        scales: {
          x: {
            grid: { display: false },
            border: { color: line },
            ticks:
              m.kind === 'line'
                ? {
                    autoSkip: false,
                    maxRotation: 0,
                    color: ink2,
                    callback(_v, i) {
                      const every = (this as unknown as { chart: Chart }).chart.width < 520 ? 72 : 36;
                      return i % every === 0 ? (model?.labels[i] ?? '') : '';
                    },
                  }
                : { color: ink2, maxRotation: 0, autoSkip: true },
          },
          y: {
            beginAtZero: true,
            grid: { color: line },
            border: { display: false },
            ticks: { color: ink2, callback: (v) => formatTick(Number(v), { lang, group: true }) },
            title: { display: true, text: unit, color: ink2 },
          },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title(items) {
                const i = items[0].dataIndex;
                const cur = model;
                return cur?.kind === 'bar' ? cur.titles[i] : (cur?.labels[i] ?? '');
              },
              label(item) {
                const v = item.parsed.y;
                const text = v === null || v === undefined || Number.isNaN(v) ? L.noData : unit === 'kW' ? kw(v, lang) : kwh(v, lang);
                return `${item.dataset.label}: ${text}`;
              },
              afterBody(items) {
                const cur = model;
                if (cur?.kind !== 'bar' || items.length === 0) return [];
                return cur.marks[items[0].dataIndex];
              },
            },
          },
        },
      },
    });
  }

  return {
    show(next, nextLang, animate) {
      const sig = `${next.kind}|${nextLang}|${next.labels.length}|${next.labels[0]}|${next.series.map((s) => s.key).join()}|${cssVar('--c-pv')}`;
      model = next;
      lang = nextLang;
      if (chart && sig === signature) {
        chart.data.labels = next.labels;
        chart.data.datasets = datasets(next);
        chart.update('none');
        return;
      }
      signature = sig;
      armed = -1;
      build(next, animate);
    },
    highlight(key) {
      marked = key;
      if (!chart || !model) return;
      chart.data.datasets = datasets(model);
      chart.update('none');
    },
    recolor() {
      if (!chart || !model) return;
      signature = '';
      build(model, false);
    },
    destroy() {
      chart?.destroy();
      chart = null;
    },
  };
}
