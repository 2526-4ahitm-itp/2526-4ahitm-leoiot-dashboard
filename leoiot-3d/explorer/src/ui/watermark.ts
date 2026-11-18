// A giant room number behind the 3D model, for the selected room (spec
// model3d/visual-design, "Selecting a room shows its number as a giant
// watermark"). Sits behind the canvas in the DOM so the building itself
// (opaque) occludes it; only visible where the scene shows no geometry.

import { el } from './dom';

const VISIBLE = 'room-watermark--visible';

export class RoomWatermark {
  readonly element = el('div', 'room-watermark');

  constructor() {
    this.element.setAttribute('aria-hidden', 'true');
  }

  /** Not `hidden`/`display:none`: this stays in the normal flow so the opacity change fades in/out. */
  show(room: string): void {
    this.element.textContent = room;
    this.element.classList.add(VISIBLE);
  }

  hide(): void {
    this.element.classList.remove(VISIBLE);
  }
}
