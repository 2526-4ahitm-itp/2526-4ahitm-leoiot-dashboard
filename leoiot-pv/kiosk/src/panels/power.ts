// Feld "Leistung": Verlauf heute, gespiegelt (Produktion oben, Verbrauch unten).
import '../styles/power.css';
import type { ChartConfiguration, ChartDataset, Plugin, Scale } from 'chart.js';
import type { PanelFactory } from '../ui/panel';
import { SOURCE_VAR, withAlpha, type Colors } from '../ui/colors';
import { Chart, axisPx, scalePx } from '../ui/chartSetup';
import { powerModel, powerTick, timeLabel, type PowerModel, type XY } from './powerModel';

type Line = ChartDataset<'line', XY[]>;

export const createPowerPanel: PanelFactory = (field, colors) => {
  const content = field.querySelector<HTMLElement>('.content');
  if (!content) throw new Error('Feld ohne .content');
  content.innerHTML =
    '<div class="chartbox"><canvas role="img" aria-label="Leistung heute: Produktion und Verbrauch in Kilowatt"></canvas>' +
    `<span class="direct"><i style="background:var(${SOURCE_VAR.pv})"></i>Produktion</span>` +
    `<span class="direct"><i style="background:var(${SOURCE_VAR.verbrauch})"></i>Verbrauch</span></div>`;
  const canvas = content.querySelector('canvas') as HTMLCanvasElement;
  const labels = content.querySelectorAll<HTMLElement>('.direct');

  let current = colors;
  let model: PowerModel | null = null;
  let dayEnd = 0;
  let signature = '';
  let drawn = false;

  // Neue Objekte, weil Chart.js aufgelöste Farben am Dataset-Objekt merkt
  const datasets = (m: PowerModel, c: Colors): Line[] => {
    const base = { fill: 'origin' as const, borderWidth: scalePx(2.5), pointRadius: 0, tension: 0.3, spanGaps: false, parsing: false as const, normalized: true as const };
    return [
      { ...base, label: 'Produktion', data: m.production, borderColor: c.pv, backgroundColor: withAlpha(c.pv, 0.1) },
      { ...base, label: 'Verbrauch', data: m.consumption, borderColor: c.verbrauch, backgroundColor: withAlpha(c.verbrauch, 0.1) },
    ];
  };

  const directLabels: Plugin<'line'> = {
    id: 'directLabels',
    afterLayout(chart) {
      const a = chart.chartArea;
      const [top, bottom] = [labels[0], labels[1]];
      top.style.left = `${a.left + 12}px`;
      top.style.top = `${a.top + 8}px`;
      bottom.style.left = `${a.left + 12}px`;
      bottom.style.top = `${a.bottom - bottom.offsetHeight - 8}px`;
    },
  };

  const fontSize = () => ({ size: axisPx() });
  const isZero = (value: number | undefined) => value === 0;

  const config: ChartConfiguration<'line', XY[]> = {
    type: 'line',
    data: { datasets: [] },
    options: {
      events: [],
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
      scales: {
        x: {
          type: 'linear',
          grid: { display: false },
          border: { display: false },
          afterBuildTicks: (axis: Scale) => {
            axis.ticks = (model?.ticks ?? []).map((value) => ({ value }));
          },
          ticks: {
            autoSkip: false,
            maxRotation: 0,
            color: () => current.ink2,
            font: fontSize,
            callback: (v) => timeLabel(Number(v), dayEnd),
          },
        },
        y: {
          type: 'linear',
          grid: {
            color: (ctx) => (isZero(ctx.tick?.value) ? current.ink3 : current.line),
            lineWidth: (ctx) => scalePx(isZero(ctx.tick?.value) ? 1.5 : 1),
          },
          border: { display: false },
          ticks: { callback: powerTick, color: () => current.ink2, font: fontSize },
          title: { display: true, text: 'kW', color: colors.ink2, font: fontSize },
        },
      },
    },
    plugins: [directLabels],
  };

  const chart = new Chart(canvas, config);

  const redraw = () => {
    if (drawn) chart.update('none');
    else {
      chart.update();
      drawn = true;
    }
  };

  return {
    update(view) {
      const m = powerModel(view.power, view.dayStart, view.dayEnd);
      const last = view.power[view.power.length - 1];
      const sig = [view.dayStart, view.dayEnd, view.power.length, last?.t, last?.production, last?.consumption, m.max].join('|');
      if (sig === signature) return;
      signature = sig;
      model = m;
      dayEnd = view.dayEnd;
      chart.data.datasets = datasets(m, current);
      const scales = chart.options.scales as {
        x: { min: number; max: number };
        y: { min: number; max: number; ticks: { stepSize: number } };
      };
      scales.x.min = view.dayStart;
      scales.x.max = view.dayEnd;
      scales.y.min = -m.max;
      scales.y.max = m.max;
      scales.y.ticks.stepSize = m.step;
      redraw();
    },
    restyle(c) {
      current = c;
      // Titelfarbe ist nicht als Funktion möglich, daher direkt setzen
      const y = chart.options.scales?.y as { title: { color: string } } | undefined;
      if (y) y.title.color = c.ink2;
      if (!model) return;
      chart.data.datasets = datasets(model, c);
      chart.update('none');
    },
  };
};
