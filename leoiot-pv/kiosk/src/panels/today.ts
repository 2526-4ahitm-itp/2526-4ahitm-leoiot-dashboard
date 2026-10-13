import '../styles/today.css';
import { SOURCE_VAR, sourceColor, type Colors } from '../ui/colors';
import { Chart, scalePx } from '../ui/chartSetup';
import type { PanelFactory } from '../ui/panel';
import { donutModel, type DonutModel } from './todayModel';

const HTML =
  '<div class="dn"><h3>Verbrauch</h3><div class="dbox"><canvas role="img"></canvas><div class="ctr"><b>–</b><small>kWh</small></div></div><ul></ul></div>' +
  '<div class="dn"><h3>Produktion</h3><div class="dbox"><canvas role="img"></canvas><div class="ctr"><b>–</b><small>kWh</small></div></div><ul></ul></div>';

interface Donut {
  name: string;
  chart: Chart<'doughnut'>;
  canvas: HTMLCanvasElement;
  center: HTMLElement;
  list: HTMLElement;
  model: DonutModel | null;
}

/** Feld "Heute": Donuts Verbrauch und Produktion. */
export const createTodayPanel: PanelFactory = (field, colors) => {
  const content = field.querySelector<HTMLElement>('.content');
  if (!content) return { update() {}, restyle() {} };
  content.classList.add('donuts');
  content.innerHTML = HTML;

  const make = (box: Element, name: string): Donut => {
    const canvas = box.querySelector('canvas') as HTMLCanvasElement;
    const chart = new Chart(canvas, {
      type: 'doughnut',
      data: { labels: [], datasets: [] },
      options: { cutout: '76%', events: [] },
    });
    return {
      name,
      chart,
      canvas,
      center: box.querySelector('.ctr b') as HTMLElement,
      list: box.querySelector('ul') as HTMLElement,
      model: null,
    };
  };
  const boxes = content.querySelectorAll('.dn');
  const donuts = [make(boxes[0], 'Verbrauch'), make(boxes[1], 'Produktion')];
  let signature = '';
  let drawn = false;

  // Neues Dataset-Objekt, weil Chart.js aufgelöste Farben am Objekt merkt
  const setData = (d: Donut, m: DonutModel, c: Colors): void => {
    d.chart.data.labels = m.rows.map((r) => r.label);
    d.chart.data.datasets = [
      m.empty
        ? { data: [1], backgroundColor: [c.line2], borderWidth: scalePx(2), borderColor: c.bg }
        : {
            data: m.rows.map((r) => r.value),
            backgroundColor: m.rows.map((r) => sourceColor(c, r.source)),
            borderWidth: scalePx(2),
            borderColor: c.bg,
          },
    ];
  };

  const render = (d: Donut, m: DonutModel): void => {
    d.model = m;
    d.center.textContent = m.center;
    d.list.replaceChildren(
      ...m.rows.map((r) => {
        const li = document.createElement('li');
        const dot = document.createElement('i');
        dot.style.background = `var(${SOURCE_VAR[r.source]})`;
        const n = document.createElement('span');
        n.className = 'n';
        n.textContent = r.label;
        const v = document.createElement('span');
        v.className = 'v';
        v.textContent = r.text;
        li.append(dot, n, v);
        return li;
      }),
    );
    d.canvas.setAttribute(
      'aria-label',
      `${d.name} heute ${m.center} kWh: ` + m.rows.map((r) => `${r.label} ${r.text}`).join(', '),
    );
  };

  return {
    update(view) {
      const models = [
        donutModel(view.consumptionTotal, view.consumptionShares),
        donutModel(view.productionTotal, view.productionShares),
      ];
      const sig = JSON.stringify(models);
      if (sig === signature) return;
      signature = sig;
      donuts.forEach((d, i) => {
        render(d, models[i]);
        setData(d, models[i], colors);
        d.chart.update(drawn ? 'none' : undefined);
      });
      drawn = true;
    },
    restyle(c) {
      colors = c;
      for (const d of donuts) {
        if (d.model) setData(d, d.model, c);
        d.chart.update('none');
      }
    },
  };
};
