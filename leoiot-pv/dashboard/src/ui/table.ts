// Tabelle der gezeigten Werte unter dem Diagramm.
import { formatNumber } from '@leoiot-pv/shared/format';
import { TEXT, type Lang } from '../core/i18n';
import { hourlyMeans, type ChartModel } from '../core/chartData';
import type { View } from '../core/route';
import { el } from './dom';

const SERIES_NAME = { prod: 'production', cons: 'consumption', imp: 'fromGrid', exp: 'toGrid' } as const;

export function renderTable(root: HTMLElement, model: ChartModel, view: View, lang: Lang, onDrill: (key: string) => void): void {
  const L = TEXT[lang];
  const cell = (v: number | null): HTMLElement =>
    v === null ? el('td', { class: 'miss' }, L.noData) : el('td', {}, formatNumber(v, { lang, group: true }));
  const head = el(
    'tr',
    {},
    el('th', { scope: 'col' }, model.kind === 'line' ? L.time : view === 'year' ? L.month : L.date),
    ...model.series.map((s) => el('th', { scope: 'col' }, L.quantities[SERIES_NAME[s.key]])),
  );
  let body: HTMLElement[];
  let caption: string;
  if (model.kind === 'line') {
    caption = L.hourlyMean;
    body = hourlyMeans(model).map((r) => el('tr', {}, el('th', { scope: 'row' }, r.label), ...r.values.map(cell)));
  } else {
    caption = view === 'year' ? L.monthChart : L.energyChart;
    body = model.titles.map((title, i) => {
      const open = el('button', { type: 'button', class: 'linkbtn' }, title);
      open.addEventListener('click', () => onDrill(model.keys[i]));
      const marks = model.marks[i];
      const first = el('th', { scope: 'row' }, open);
      if (marks.length > 0) first.append(el('span', { class: 'note' }, marks.join(' · ')));
      return el('tr', {}, first, ...model.series.map((s) => cell(s.data[i])));
    });
  }
  root.replaceChildren(el('table', {}, el('caption', {}, caption), el('thead', {}, head), el('tbody', {}, ...body)));
}
