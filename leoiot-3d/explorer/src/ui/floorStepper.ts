// Floor switching as three bare buttons — an arrow at the top of the
// screen, an arrow at the bottom, and Gym on the right — not grouped into
// a panel (FSD FR-11, always visible). Mirrors the up/down arrow-key
// behaviour in app.ts exactly, as another way to do the same thing, not a
// second piece of logic.

import { FLOOR_ORDER } from '../core/rooms';
import type { ViewId } from '../scene/models';
import { el } from './dom';
import { strings } from './strings';

export class FloorStepper {
  readonly upElement = el('button', 'button floor-arrow floor-arrow-up', '▲');
  readonly downElement = el('button', 'button floor-arrow floor-arrow-down', '▼');
  readonly gymElement = el('button', 'button floor-gym', strings.views.T);

  onStep: (direction: 1 | -1) => void = () => undefined;
  onGym: () => void = () => undefined;

  constructor() {
    this.upElement.setAttribute('aria-label', strings.floorStepper.up);
    this.downElement.setAttribute('aria-label', strings.floorStepper.down);
    this.upElement.addEventListener('click', () => this.onStep(-1));
    this.downElement.addEventListener('click', () => this.onStep(1));
    this.gymElement.addEventListener('click', () => this.onGym());
  }

  update(view: ViewId): void {
    const isGym = view === 'T';
    const index = view === 'full' ? -1 : (FLOOR_ORDER as readonly string[]).indexOf(view);
    this.upElement.disabled = isGym || index - 1 < 0;
    this.downElement.disabled = isGym || index + 1 >= FLOOR_ORDER.length;
    this.gymElement.setAttribute('aria-pressed', String(isGym));
  }
}
