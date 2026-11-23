// The colour scale of the shown heatmap, a panel on the right above the route
// legend, only while a heatmap is on (spec model3d/room-heatmap).
// Drawn from the same stops that colour the rooms, plus the grey of a stale value.

import { scaleStops, STALE_COLOUR } from '../core/colours';
import type { HeatmapKind } from '../core/heatmap';
import { el } from './dom';
import { strings } from './strings';

export class HeatmapLegend {
  readonly element = el('div', 'heatmap-legend');
  private readonly title = el('div', 'route-legend-title');
  private readonly bar = el('div', 'heatmap-legend-bar');
  private readonly ticks = el('div', 'heatmap-legend-ticks');
  private kind: HeatmapKind | null = null;

  constructor() {
    this.element.hidden = true;
    this.element.setAttribute('aria-label', strings.heatmap.legend);
    const scale = el('div', 'heatmap-legend-scale');
    scale.append(this.bar, this.ticks);
    const stale = el('div', 'heatmap-legend-stale');
    const swatch = el('span', 'heatmap-legend-swatch');
    swatch.style.backgroundColor = STALE_COLOUR;
    stale.append(swatch, el('span', undefined, strings.heatmap.outdated));
    this.element.append(this.title, scale, stale);
  }

  /** Shows the scale of `kind`, or hides the legend for null. */
  show(kind: HeatmapKind | null): void {
    this.element.hidden = kind === null;
    if (kind === null || kind === this.kind) return;
    this.kind = kind;
    this.title.textContent = strings.heatmap[kind];
    const stops = scaleStops(kind);
    this.bar.style.setProperty('--stops', stops.map((s) => `${s.colour} ${(s.at * 100).toFixed(1)}%`).join(', '));
    this.ticks.replaceChildren(
      ...stops.map((s) => {
        const tick = el('span', 'heatmap-legend-tick', String(s.value));
        tick.append(el('span', 'heatmap-legend-unit', kind === 'co2' ? ' ppm' : '°C'));
        tick.style.setProperty('--at', `${(s.at * 100).toFixed(1)}%`);
        return tick;
      }),
    );
  }
}
