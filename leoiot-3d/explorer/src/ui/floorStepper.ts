// Floor switching as an up/down stepper plus a separate Gym button, floating
// on its own (not in the bottom dock) (FSD FR-11, always visible). Mirrors
// the up/down arrow-key behaviour in app.ts exactly, as another way to do
// the same thing, not a second piece of logic.

import { FLOOR_ORDER } from '../core/rooms';
import type { ViewId } from '../scene/models';
import { el } from './dom';
import { strings } from './strings';

export class FloorStepper {
  readonly element = el('div', 'floor-stepper');
  private readonly up = el('button', 'button floor-stepper-arrow', '▲');
  private readonly label = el('div', 'floor-stepper-label');
  private readonly down = el('button', 'button floor-stepper-arrow', '▼');
  private readonly gym = el('button', 'button floor-stepper-gym', strings.views.T);

  onStep: (direction: 1 | -1) => void = () => undefined;
  onGym: () => void = () => undefined;

  constructor() {
    this.up.setAttribute('aria-label', strings.floorStepper.up);
    this.down.setAttribute('aria-label', strings.floorStepper.down);
    this.up.addEventListener('click', () => this.onStep(-1));
    this.down.addEventListener('click', () => this.onStep(1));
    this.gym.addEventListener('click', () => this.onGym());

    const stack = el('div', 'floor-stepper-stack');
    stack.append(this.up, this.label, this.down);
    this.element.append(stack, this.gym);
  }

  update(view: ViewId): void {
    const isGym = view === 'T';
    this.label.textContent = strings.views[view];
    const index = view === 'full' ? -1 : (FLOOR_ORDER as readonly string[]).indexOf(view);
    this.up.disabled = isGym || index - 1 < 0;
    this.down.disabled = isGym || index + 1 >= FLOOR_ORDER.length;
    this.gym.setAttribute('aria-pressed', String(isGym));
  }
}
