// Always visible buttons: views, reset and heatmaps (FSD FR-11).

import type { HeatmapKind } from '../core/heatmap';
import type { ViewId } from '../scene/models';
import { el } from './dom';
import { strings } from './strings';

// Top to bottom as in the building
const FLOOR_BUTTONS = ['2', '1', 'E', 'U'] as const;

export class Controls {
  readonly element = el('nav', 'bar');
  private readonly views = new Map<ViewId, HTMLButtonElement>();
  private readonly heatmaps = new Map<HeatmapKind, HTMLButtonElement>();
  private readonly reset = el('button', 'button', strings.views.reset);

  onView: (view: ViewId) => void = () => undefined;
  onReset: () => void = () => undefined;
  onHeatmap: (kind: HeatmapKind) => void = () => undefined;

  constructor() {
    const actions = el('div', 'bar-group');
    for (const k of ['temperature', 'co2'] as const) {
      const b = el('button', 'button', strings.heatmap[k]);
      b.addEventListener('click', () => this.onHeatmap(k));
      this.heatmaps.set(k, b);
      actions.append(b);
    }
    this.reset.addEventListener('click', () => this.onReset());
    actions.append(this.reset);

    const gym = el('div', 'bar-group');
    gym.append(this.viewButton('T'));

    const floors = el('div', 'bar-group');
    for (const v of FLOOR_BUTTONS) floors.append(this.viewButton(v));
    this.element.append(actions, gym, floors);
  }

  private viewButton(view: (typeof FLOOR_BUTTONS)[number] | 'T'): HTMLButtonElement {
    const b = el('button', 'button', strings.views[view]);
    b.addEventListener('click', () => this.onView(view));
    this.views.set(view, b);
    return b;
  }

  update(view: ViewId, heatmap: HeatmapKind | null, heatmapAllowed: boolean): void {
    for (const [v, b] of this.views) b.setAttribute('aria-pressed', String(v === view));
    // Stands out only when another view is shown; in the whole building it still resets the camera
    this.reset.classList.toggle('button-reset', view !== 'full');
    for (const [k, b] of this.heatmaps) {
      b.setAttribute('aria-pressed', String(k === heatmap));
      b.disabled = !heatmapAllowed;
    }
  }
}
