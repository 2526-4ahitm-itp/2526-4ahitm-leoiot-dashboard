// Info panel of the selected room (spec model3d/room-climate-view).

import { freshness } from '../core/age';
import { STATUS_COLOUR } from '../core/colours';
import { formatCo2, formatTemperatureSpaced } from '../core/format';
import type { Reading } from '../core/messages';
import { co2Status } from '../core/status';
import { readingTime } from '../core/time';
import { el } from './dom';
import { strings } from './strings';

/** FR-07 status as a coloured symbol, with its text unless only the symbol fits (heatmap labels). */
export function statusBadge(ppm: number, withText = true): HTMLElement {
  const status = co2Status(ppm);
  const badge = el('span', 'status');
  const dot = el('span', 'status-dot');
  dot.style.background = STATUS_COLOUR[status];
  dot.title = strings.status[status];
  badge.append(dot);
  if (withText) badge.append(el('span', 'status-text', strings.status[status]));
  return badge;
}

export class InfoPanel {
  readonly element = el('aside', 'panel');
  private readonly title = el('h2', 'panel-title');
  private readonly body = el('div', 'panel-body');

  onClose: () => void = () => undefined;

  constructor() {
    this.element.hidden = true;
    this.element.setAttribute('aria-live', 'polite');
    const close = el('button', 'panel-close', '×');
    close.setAttribute('aria-label', strings.panel.close);
    close.addEventListener('click', () => this.onClose());
    const head = el('div', 'panel-head');
    head.append(this.title, close);
    this.element.append(head, this.body);
  }

  hide(): void {
    this.element.hidden = true;
  }

  show(room: string, reading: Reading | undefined, now: number): void {
    this.element.hidden = false;
    this.title.textContent = room;
    this.body.replaceChildren();
    this.element.classList.remove('panel-is-stale');
    if (!reading) {
      this.body.append(el('p', 'panel-nodata', strings.panel.noData));
      return;
    }
    const stale = freshness(reading.ts, now) === 'stale';
    if (stale) this.body.append(el('p', 'panel-stale', `⚠ ${strings.panel.outdated}`));

    const co2 = el('div', 'panel-row');
    co2.append(el('span', 'panel-label', strings.panel.co2));
    const co2Value = el('span', 'panel-value', reading.co2 === undefined ? strings.panel.unknown : formatCo2(reading.co2));
    co2.append(co2Value);
    if (reading.co2 !== undefined) co2.append(statusBadge(reading.co2));

    const temp = el('div', 'panel-row');
    temp.append(
      el('span', 'panel-label', strings.panel.temperature),
      el('span', 'panel-value', reading.temperature === undefined ? strings.panel.unknown : formatTemperatureSpaced(reading.temperature)),
    );

    const time = el('p', 'panel-time', `${strings.panel.lastReading}: ${readingTime(reading.ts, now)}`);
    this.body.append(co2, temp, time);
    this.element.classList.toggle('panel-is-stale', stale);
  }
}
