// Floor switching as three bare arrow buttons, each captioned with where it
// leads — an arrow at the top of the screen, an arrow at the bottom, and a
// right-pointing arrow to the gym on the right — not grouped into a panel
// (FSD FR-11, always visible). Mirrors the up/down arrow-key behaviour in
// app.ts exactly, as another way to do the same thing, not a second piece
// of logic.

import { FLOOR_ORDER } from '../core/rooms';
import type { ViewId } from '../scene/models';
import { el } from './dom';
import { strings } from './strings';

export class FloorStepper {
  readonly upElement = el('div', 'floor-arrow-group floor-arrow-group-up');
  readonly downElement = el('div', 'floor-arrow-group floor-arrow-group-down');
  readonly gymElement = el('div', 'floor-arrow-group floor-arrow-group-gym');

  private readonly upButton = el('button', 'button floor-arrow', '▲');
  private readonly upCaption = el('span', 'floor-arrow-caption');
  private readonly downButton = el('button', 'button floor-arrow', '▼');
  private readonly downCaption = el('span', 'floor-arrow-caption');
  private readonly gymButton = el('button', 'button floor-arrow', '▶');
  private readonly gymCaption = el('span', 'floor-arrow-caption', strings.views.T);

  onStep: (direction: 1 | -1) => void = () => undefined;
  onGym: () => void = () => undefined;

  constructor() {
    this.upButton.setAttribute('aria-label', strings.floorStepper.up);
    this.downButton.setAttribute('aria-label', strings.floorStepper.down);
    this.gymButton.setAttribute('aria-label', strings.floorStepper.gym);
    this.upButton.addEventListener('click', () => this.onStep(-1));
    this.downButton.addEventListener('click', () => this.onStep(1));
    this.gymButton.addEventListener('click', () => this.onGym());

    this.upElement.append(this.upButton, this.upCaption);
    this.downElement.append(this.downCaption, this.downButton);
    this.gymElement.append(this.gymCaption, this.gymButton);
  }

  update(view: ViewId): void {
    const isGym = view === 'T';
    const index = view === 'full' ? -1 : (FLOOR_ORDER as readonly string[]).indexOf(view);
    const upTarget = index - 1;
    const downTarget = index + 1;
    this.upButton.disabled = isGym || upTarget < 0;
    this.downButton.disabled = isGym || downTarget >= FLOOR_ORDER.length;
    this.upCaption.textContent = this.upButton.disabled ? '' : strings.views[FLOOR_ORDER[upTarget]];
    this.downCaption.textContent = this.downButton.disabled ? '' : strings.views[FLOOR_ORDER[downTarget]];
    this.gymButton.setAttribute('aria-pressed', String(isGym));
  }
}
