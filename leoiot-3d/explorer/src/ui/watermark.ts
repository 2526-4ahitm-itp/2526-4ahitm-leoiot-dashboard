// A giant room number behind the 3D model, for the selected room (spec
// model3d/visual-design, "Selecting a room shows its number as a giant
// watermark"). Sits behind the canvas in the DOM so the building itself
// (opaque) occludes it; only visible where the scene shows no geometry.

import { el } from './dom';

export class RoomWatermark {
  readonly element = el('div', 'room-watermark');

  constructor() {
    this.element.hidden = true;
    this.element.setAttribute('aria-hidden', 'true');
  }

  show(room: string): void {
    this.element.textContent = room;
    this.element.hidden = false;
  }

  hide(): void {
    this.element.hidden = true;
  }
}
