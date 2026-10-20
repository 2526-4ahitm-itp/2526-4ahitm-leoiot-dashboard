// Zahlenblock: sieben Größen, Autarkie und Eigenverbrauchsquote mit Erklärung und Hinweisen.
import { MISSING } from '@leoiot-pv/shared/format';
import { daysPlain, missingSummary } from '../core/gaps';
import { dateShort, kwh, pct, TEXT, type Lang, type Texts } from '../core/i18n';
import type { DayRow, Quantities, Totals } from '../core/periods';
import type { View } from '../core/route';
import { el, swatch } from './dom';

export const FIGURE_ORDER: (keyof Quantities)[] = ['prod', 'cons', 'self', 'imp', 'exp', 'dis', 'chg'];

const NAME: Record<keyof Quantities, keyof Texts['quantities']> = {
  prod: 'production',
  cons: 'consumption',
  self: 'selfConsumption',
  imp: 'fromGrid',
  exp: 'toGrid',
  dis: 'fromBattery',
  chg: 'toBattery',
};

export const quantityName = (k: keyof Quantities, lang: Lang): string => TEXT[lang].quantities[NAME[k]];

export interface FiguresInput {
  view: View;
  rows: DayRow[];
  totals: Totals;
  lang: Lang;
}

export function renderFigures(grid: HTMLElement, ratios: HTMLElement, note: HTMLElement, i: FiguresInput): void {
  const L = TEXT[i.lang];
  const day = i.view === 'day';
  const gapDay = day && i.rows[0].gap;
  const t = i.totals;
  const miss = day ? { common: null, extra: {} } : missingSummary(i.rows, t.sum);
  note.textContent = miss.common ? L.totalsExclude(miss.common.n, daysPlain(i.rows, miss.common.days, i.view, i.lang)) : '';

  grid.replaceChildren(
    ...FIGURE_ORDER.map((k) => {
      const v = t.sum[k];
      const dd = el('dd', { class: v === null ? 'none' : 'num' }, v === null ? L.noData : kwh(v, i.lang));
      const extra = (miss.extra as Partial<Record<keyof Quantities, number>>)[k];
      if (v !== null && extra !== undefined) dd.append(el('span', { class: 'note' }, L.incomplete(extra)));
      if (v === null && gapDay) dd.append(el('span', { class: 'note' }, L.gapDay));
      else if (v === null && t.sum.prod !== null) dd.append(el('span', { class: 'note' }, L.noDataBefore));
      return el('div', { class: 'fig' }, el('dt', {}, swatch(k), quantityName(k, i.lang)), dd);
    }),
  );

  const cover =
    !day && t.ratioDays > 0 && t.ratioDays < t.pastDays && t.ratioFrom !== null && t.ratioTo !== null
      ? L.ratiosCover(dateShort(t.ratioFrom, i.lang), dateShort(t.ratioTo, i.lang))
      : '';
  const ratio = (name: string, value: number | null, explain: string, noProduction: boolean): HTMLElement => {
    const v = el('span', { class: 'v' + (value === null ? '' : ' num') }, value === null ? (noProduction ? MISSING : L.noData) : pct(value, i.lang));
    const dd = el('dd', {}, v, el('span', { class: 'e' }, explain));
    if (value !== null && cover) dd.append(el('span', { class: 'note' }, cover));
    if (value === null && noProduction) dd.append(el('span', { class: 'note' }, L.noProduction));
    else if (value === null && (gapDay || t.sum.prod !== null)) dd.append(el('span', { class: 'note' }, gapDay ? L.gapDay : L.noDataBefore));
    return el('div', {}, el('dt', {}, name), dd);
  };
  ratios.replaceChildren(
    ratio(L.autarky, t.ratios.autarky, L.autarkyExplain, false),
    ratio(L.selfRate, t.ratios.selfRate, L.selfRateExplain, t.sum.prod === 0),
  );
}
