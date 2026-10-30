// Always visible buttons: views, reset and heatmaps (FSD FR-11).

import type { HeatmapKind } from '../core/heatmap';
import type { ViewId } from '../scene/models';
import { el } from './dom';
import { strings } from './strings';

const FLOOR_BUTTONS = ['U', 'E', '1', '2', 'T'] as const;

export class Controls {
  readonly element = el('nav', 'bar');
  private readonly views = new Map<ViewId, HTMLButtonElement>();
  private readonly heatmaps = new Map<HeatmapKind, HTMLButtonElement>();

  onView: (view: ViewId) => void = () => undefined;
  onReset: () => void = () => undefined;
  onHeatmap: (kind: HeatmapKind) => void = () => undefined;

  constructor() {
    const viewGroup = el('div', 'bar-group');
    for (const v of FLOOR_BUTTONS) {
      const b = el('button', 'button', strings.views[v]);
      b.addEventListener('click', () => this.onView(v));
      this.views.set(v, b);
      viewGroup.append(b);
    }
    const reset = el('button', 'button', strings.views.reset);
    reset.addEventListener('click', () => this.onReset());
    viewGroup.append(reset);

    const heatGroup = el('div', 'bar-group');
    for (const k of ['temperature', 'co2'] as const) {
      const b = el('button', 'button', strings.heatmap[k]);
      b.addEventListener('click', () => this.onHeatmap(k));
      this.heatmaps.set(k, b);
      heatGroup.append(b);
    }
    this.element.append(viewGroup, heatGroup);
  }

  update(view: ViewId, heatmap: HeatmapKind | null, heatmapAllowed: boolean): void {
    for (const [v, b] of this.views) b.setAttribute('aria-pressed', String(v === view));
    for (const [k, b] of this.heatmaps) {
      b.setAttribute('aria-pressed', String(k === heatmap));
      b.disabled = !heatmapAllowed;
    }
  }
}
