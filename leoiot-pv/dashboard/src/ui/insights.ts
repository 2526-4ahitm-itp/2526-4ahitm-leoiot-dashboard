// Spitzen des Tages und Kennzahlen des Zeitraums als Definitionslisten mit Erklär-Knöpfen.
import { MISSING } from '@leoiot-pv/shared/format';
import type { ExplainKey, Lang } from '../core/i18n';
import { dayMonth, kw, kwh, pct, TEXT } from '../core/i18n';
import type { DayPeaks, Peak } from '../core/peaks';
import type { Extreme, KeyFigures, Mean } from '../core/keyFigures';
import { el } from './dom';
import { infoButton } from './info';

/** Name mit Erklär-Knopf (dt). */
export function nameWithInfo(key: ExplainKey, name: string, lang: Lang, lead?: Node): HTMLElement {
  const L = TEXT[lang];
  return el('dt', {}, ...(lead ? [lead] : []), el('span', {}, name), infoButton(key, L.infoLabel(name), L.explain[key]));
}

export interface PeaksInput {
  peaks: DayPeaks | null;
  today: boolean;
  lang: Lang;
}

export function renderPeaks(root: HTMLElement, i: PeaksInput): void {
  const L = TEXT[i.lang];
  root.replaceChildren();
  if (i.peaks === null) return;
  const peak = (key: 'prodPeak' | 'gridPeak', p: Peak | null): HTMLElement => {
    const dd = el('dd', { class: p === null ? 'none' : 'num' });
    if (p === null) dd.append(L.noData);
    else {
      dd.append(kw(p.kw, i.lang));
      dd.append(el('span', { class: 'note' }, p.time === null ? L.noGridDraw : L.atTime(p.time) + (i.today ? ` · ${L.soFar}` : '')));
    }
    return el('div', { class: 'fig' }, nameWithInfo(key, L.names[key], i.lang), dd);
  };
  const b = i.peaks.baseLoad;
  const base = el('dd', { class: b === null ? 'none' : 'num' });
  if (b === null) base.append(L.noData);
  else {
    base.append(kw(b.kw, i.lang));
    if (b.partial) base.append(el('span', { class: 'note' }, L.soFar));
  }
  root.append(
    peak('prodPeak', i.peaks.prodPeak),
    peak('gridPeak', i.peaks.gridPeak),
    el('div', { class: 'fig' }, nameWithInfo('baseLoad', L.names.baseLoad, i.lang), base),
  );
}

export interface KeyFiguresInput {
  figures: KeyFigures;
  lang: Lang;
  onOpenDay: (key: string) => void;
}

export function renderKeyFigures(root: HTMLElement, i: KeyFiguresInput): void {
  const L = TEXT[i.lang];
  const f = i.figures;
  root.replaceChildren();
  if (f.completeness === null) return;
  const open = (key: string): HTMLElement => {
    const b = el('button', { type: 'button', class: 'daylink' }, dayMonth(key, i.lang));
    b.addEventListener('click', () => i.onOpenDay(key));
    return b;
  };
  const extreme = (key: ExplainKey, e: Extreme | null): HTMLElement => {
    const dd = el('dd', { class: e === null ? 'none' : 'num' });
    if (e === null) dd.append(L.noData);
    else {
      dd.append(kwh(e.value, i.lang), ' · ', open(e.key));
      if (key === 'bestDay' || key === 'worstDay') dd.append(el('span', { class: 'note' }, L.quantities.production));
      if (e.today) dd.append(el('span', { class: 'note' }, L.notFinished));
    }
    return el('div', { class: 'fig' }, nameWithInfo(key, L.names[key as keyof typeof L.names], i.lang), dd);
  };
  const mean = (label: string, m: Mean | null): string => (m === null ? `${label} ${MISSING}` : `${label} ${kwh(m.value, i.lang)}`);
  const meanDd = el('dd', { class: f.meanProd === null && f.meanCons === null ? 'none' : 'num' });
  if (f.meanProd === null && f.meanCons === null) meanDd.append(L.noData);
  else {
    meanDd.append(mean(L.quantities.production, f.meanProd), el('br'), mean(L.quantities.consumption, f.meanCons));
    if (f.meanProd?.includesToday || f.meanCons?.includesToday) meanDd.append(el('span', { class: 'note' }, L.notFinished));
  }
  const c = f.completeness;
  const compDd = el('dd', { class: 'num' }, L.completenessValue(pct(c.percent / 100, i.lang), c.complete, c.past));
  if (c.includesToday) compDd.append(el('span', { class: 'note' }, L.notFinished));
  root.append(
    extreme('bestDay', f.bestProd),
    extreme('worstDay', f.worstProd),
    extreme('maxCons', f.maxCons),
    extreme('maxImp', f.maxImp),
    el('div', { class: 'fig' }, nameWithInfo('meanDay', L.names.meanDay, i.lang), meanDd),
    el('div', { class: 'fig' }, nameWithInfo('completeness', L.names.completeness, i.lang), compDd),
  );
}
