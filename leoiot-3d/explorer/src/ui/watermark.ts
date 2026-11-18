// A giant room number behind the 3D model, for the selected room (spec
// model3d/visual-design, "Selecting a room shows its number as a giant
// watermark"). Sits behind the canvas in the DOM so the building itself
// (opaque) occludes it; only visible where the scene shows no geometry.

import { el } from './dom';

const VISIBLE = 'room-watermark--visible';
// Room ids vary widely in length (e.g. "130" vs "UBiolab"); this leaves
// a visible margin on each side once the id has been shrunk to fit.
const MAX_WIDTH_FRACTION = 0.94;

export class RoomWatermark {
  readonly element = el('div', 'room-watermark');
  private current: string | null = null;

  constructor() {
    this.element.setAttribute('aria-hidden', 'true');
    window.addEventListener('resize', () => this.refit());
  }

  /**
   * Not `hidden`/`display:none`: this stays in the normal flow so the
   * opacity change fades in/out. `temperatureColour`/`co2Colour` are the
   * already-resolved colours for the left/right halves (a heatmap-scale
   * colour, or the caller's generic fallback for no/stale data) — this
   * component only paints them, it has no notion of readings or staleness.
   * Called on every render while a room stays selected, not just once on
   * selection, so a live reading change repaints without reselecting.
   */
  show(room: string, temperatureColour: string, co2Colour: string): void {
    this.current = room;
    this.element.textContent = room;
    this.element.style.setProperty('--watermark-temp', temperatureColour);
    this.element.style.setProperty('--watermark-co2', co2Colour);
    this.element.classList.add(VISIBLE);
    this.refit();
  }

  hide(): void {
    this.element.classList.remove(VISIBLE);
    this.current = null;
  }

  /**
   * The CSS `font-size: min(100vh, 54vw)` is sized for a short id and lets a
   * long one (e.g. "UBiolab") overflow the screen width. This measures the
   * actual rendered width and scales the font down just enough to fit,
   * rather than guessing a formula for every id length up front.
   */
  private refit(): void {
    if (this.current === null) return;
    this.element.style.fontSize = ''; // back to the CSS baseline before measuring
    const maxWidth = window.innerWidth * MAX_WIDTH_FRACTION;
    const width = this.measureWidth();
    if (width <= maxWidth) return;
    const baseSize = parseFloat(getComputedStyle(this.element).fontSize);
    this.element.style.fontSize = `${(baseSize * maxWidth) / width}px`;
  }

  /**
   * `this.element.scrollWidth` is unreliable here: with `justify-content:
   * center`, a browser can under-report the scroll width of content that
   * overflows symmetrically on both sides (confirmed by comparing it
   * against this Range measurement, which stayed exactly linear with
   * font-size while scrollWidth did not). A Range around the text content
   * measures the actual rendered box directly, unaffected by how the flex
   * container aligns the overflow.
   */
  private measureWidth(): number {
    const range = document.createRange();
    range.selectNodeContents(this.element);
    return range.getBoundingClientRect().width;
  }
}
