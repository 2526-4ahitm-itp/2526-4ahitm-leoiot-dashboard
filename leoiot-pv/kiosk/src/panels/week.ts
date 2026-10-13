// Wochenübersicht: gruppierte Balken für sieben Tage.
import '../styles/week.css';
import { SOURCE_VAR, sourceColor, type Colors } from '../ui/colors';
import { Chart, axisPx, scalePx } from '../ui/chartSetup';
import type { PanelFactory } from '../ui/panel';
import { weekModel, weekTick, type WeekModel } from './weekModel';

const radius = () => ({ topLeft: scalePx(3), topRight: scalePx(3), bottomLeft: 0, bottomRight: 0 });

export const createWeekPanel: PanelFactory = (field, colors) => {
  let c: Colors = colors;
  let model: WeekModel = weekModel([]);
  let signature = '';
  let drawn = false;

  const content = field.querySelector('.content');
  const head = field.querySelector('.head');
  if (content) {
    content.innerHTML = '<div class="chartbox"><canvas role="img" aria-label="Wochenübersicht"></canvas></div>';
  }
  const canvas = field.querySelector('canvas') as HTMLCanvasElement;

  // Legende aus den Namen und Variablen der Quellen
  const legend = document.createElement('div');
  legend.className = 'legend when-ok';
  for (const s of model.series) {
    const item = document.createElement('span');
    const dot = document.createElement('i');
    dot.style.background = `var(${SOURCE_VAR[s.source]})`;
    item.append(dot, s.label);
    legend.append(item);
  }
  head?.append(legend);

  const isToday = (index: number): boolean => index === model.labels.length - 1;

  /** Immer neue Dataset-Objekte, weil Chart.js aufgelöste Farben am Objekt merkt. */
  const datasets = () =>
    model.series.map((s) => ({
      label: s.label,
      data: s.data,
      backgroundColor: sourceColor(c, s.source),
      borderRadius: radius(),
      borderSkipped: false as const,
      categoryPercentage: 0.8,
      barPercentage: 0.86,
    }));

  const chart = new Chart(canvas, {
    type: 'bar',
    data: { labels: model.labels, datasets: datasets() },
    options: {
      events: [],
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
      scales: {
        x: {
          grid: { display: false },
          border: { color: c.ink3 },
          ticks: {
            color: (ctx) => (isToday(ctx.index) ? c.ink : c.ink2),
            font: (ctx) => ({ size: axisPx(), weight: isToday(ctx.index) ? 700 : 400 }),
          },
        },
        y: {
          beginAtZero: true,
          grid: { color: (ctx) => (ctx.tick && ctx.tick.value === 0 ? c.ink3 : c.line) },
          border: { display: false },
          ticks: {
            callback: weekTick,
            color: () => c.ink2,
            font: () => ({ size: axisPx() }),
            maxTicksLimit: 6,
          },
          title: {
            display: true,
            text: 'kWh',
            color: c.ink2,
            font: () => ({ size: axisPx() }),
          },
        },
      },
    },
  });

  return {
    update(view) {
      const m = weekModel(view.week);
      const sig = JSON.stringify(m);
      if (sig === signature) return;
      signature = sig;
      model = m;
      chart.data.labels = m.labels;
      chart.data.datasets = datasets();
      if (drawn) chart.update('none');
      else {
        chart.update();
        drawn = true;
      }
    },
    restyle(next) {
      c = next;
      // Diese beiden Farben sind keine Funktionen, daher hier neu setzen
      const sc = chart.options.scales;
      if (sc?.x?.border) sc.x.border.color = c.ink3;
      if (sc?.y?.title) sc.y.title.color = c.ink2;
      chart.data.datasets = datasets();
      chart.update('none');
    },
  };
};
