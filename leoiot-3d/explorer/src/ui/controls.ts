// Always visible buttons: views, reset and heatmaps (FSD FR-11).
// Exposes two dock groups ("Floors" and "Overlays") for the bottom dock (model3d/visual-design).

import { FLOOR_ORDER } from '../core/rooms';
import type { HeatmapKind } from '../core/heatmap';
import type { ViewId } from '../scene/models';
import { el } from './dom';
import { strings } from './strings';

const FLOOR_BUTTONS = FLOOR_ORDER;

export class Controls {
  /** The "Floors" dock group: view switching (floors, gym) and reset. */
  readonly element = el('nav', 'dock-group');
  /** The "Overlays" dock group: heatmap toggles. */
  readonly overlaysElement = el('div', 'dock-group');
  private readonly views = new Map<ViewId, HTMLButtonElement>();
  private readonly heatmaps = new Map<HeatmapKind, HTMLButtonElement>();
  private readonly reset = el('button', 'button', strings.views.reset);

  onView: (view: ViewId) => void = () => undefined;
  onReset: () => void = () => undefined;
  onHeatmap: (kind: HeatmapKind) => void = () => undefined;

  constructor() {
    const floorButtons = el('div', 'dock-group-buttons');
    floorButtons.append(this.viewButton('T'));
    for (const v of FLOOR_BUTTONS) floorButtons.append(this.viewButton(v));
    this.reset.addEventListener('click', () => this.onReset());
    floorButtons.append(this.reset);
    this.element.append(el('span', 'dock-group-label', strings.dock.floors), floorButtons);

    const overlayButtons = el('div', 'dock-group-buttons');
    for (const k of ['temperature', 'co2'] as const) {
      const b = el('button', 'button', strings.heatmap[k]);
      b.addEventListener('click', () => this.onHeatmap(k));
      this.heatmaps.set(k, b);
      overlayButtons.append(b);
    }
    this.overlaysElement.append(el('span', 'dock-group-label', strings.dock.overlays), overlayButtons);
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
