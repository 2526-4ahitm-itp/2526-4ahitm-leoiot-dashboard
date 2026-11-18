// Floor switching as four bare arrow buttons, each captioned with where it
// leads — an arrow at the top of the screen, an arrow at the bottom, a
// right-pointing arrow to the gym on the right, and (only while the gym is
// shown) a left-pointing arrow back to the overview — not grouped into a
// panel (FSD FR-11, always visible). Mirrors the up/down arrow-key
// behaviour in app.ts exactly, as another way to do the same thing, not a
// second piece of logic.

import { FLOOR_ORDER } from '../core/rooms';
import type { ViewId } from '../scene/models';
import { el } from './dom';
import { strings } from './strings';

export class FloorStepper {
  readonly upElement = el('div', 'floor-arrow-group floor-arrow-group-up');
  readonly downElement = el('div', 'floor-arrow-group floor-arrow-group-down');
  readonly gymElement = el('div', 'floor-arrow-group floor-arrow-group-gym');
  /** Only shown while the gym is the current view — there is no other way back to the overview from it. */
  readonly backElement = el('div', 'floor-arrow-group floor-arrow-group-back');

  // One simple chevron glyph (a ">" shape), rotated per direction in CSS
  // rather than four different Unicode arrow glyphs — a consistent shape,
  // not four slightly-different ones.
  private readonly upButton = el('button', 'floor-arrow floor-arrow-up', '>');
  private readonly upCaption = el('span', 'floor-arrow-caption');
  private readonly downButton = el('button', 'floor-arrow floor-arrow-down', '>');
  private readonly downCaption = el('span', 'floor-arrow-caption');
  private readonly gymButton = el('button', 'floor-arrow floor-arrow-right', '>');
  private readonly gymCaption = el('span', 'floor-arrow-caption', strings.views.T);
  private readonly backButton = el('button', 'floor-arrow floor-arrow-left', '>');
  private readonly backCaption = el('span', 'floor-arrow-caption', strings.views.full);

  onStep: (direction: 1 | -1) => void = () => undefined;
  onGym: () => void = () => undefined;
  onBack: () => void = () => undefined;

  constructor() {
    this.upButton.setAttribute('aria-label', strings.floorStepper.up);
    this.downButton.setAttribute('aria-label', strings.floorStepper.down);
    this.gymButton.setAttribute('aria-label', strings.floorStepper.gym);
    this.backButton.setAttribute('aria-label', strings.floorStepper.back);
    this.upButton.addEventListener('click', () => this.onStep(-1));
    this.downButton.addEventListener('click', () => this.onStep(1));
    this.gymButton.addEventListener('click', () => this.onGym());
    this.backButton.addEventListener('click', () => this.onBack());

    this.upElement.append(this.upButton, this.upCaption);
    this.downElement.append(this.downCaption, this.downButton);
    this.gymElement.append(this.gymCaption, this.gymButton);
    this.backElement.append(this.backButton, this.backCaption);
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
    this.backElement.hidden = !isGym;
  }
}
