// Always visible buttons: reset and heatmaps (FSD FR-11). Floor/gym
// switching lives in ui/floorStepper.ts instead.
// Exposes two dock groups ("View" and "Overlays") for the bottom dock (model3d/visual-design).

import type { HeatmapKind } from '../core/heatmap';
import type { ViewId } from '../scene/models';
import { el } from './dom';
import { strings } from './strings';

export class Controls {
  /** The "View" dock group: just Reset View. */
  readonly resetElement = el('nav', 'dock-group');
  /** The "Overlays" dock group: heatmap toggles. */
  readonly overlaysElement = el('div', 'dock-group');
  private readonly heatmaps = new Map<HeatmapKind, HTMLButtonElement>();
  private readonly reset = el('button', 'button', strings.views.reset);

  onReset: () => void = () => undefined;
  onHeatmap: (kind: HeatmapKind) => void = () => undefined;

  constructor() {
    this.reset.addEventListener('click', () => this.onReset());
    const resetButtons = el('div', 'dock-group-buttons');
    resetButtons.append(this.reset);
    this.resetElement.append(el('span', 'dock-group-label', strings.dock.view), resetButtons);

    const overlayButtons = el('div', 'dock-group-buttons');
    for (const k of ['temperature', 'co2'] as const) {
      const b = el('button', 'button', strings.heatmap[k]);
      b.addEventListener('click', () => this.onHeatmap(k));
      this.heatmaps.set(k, b);
      overlayButtons.append(b);
    }
    this.overlaysElement.append(el('span', 'dock-group-label', strings.dock.overlays), overlayButtons);
  }

  update(view: ViewId, heatmap: HeatmapKind | null, heatmapAllowed: boolean): void {
    // Stands out only when another view is shown; in the whole building it still resets the camera
    this.reset.classList.toggle('button-reset', view !== 'full');
    for (const [k, b] of this.heatmaps) {
      b.setAttribute('aria-pressed', String(k === heatmap));
      b.disabled = !heatmapAllowed;
    }
  }
}
