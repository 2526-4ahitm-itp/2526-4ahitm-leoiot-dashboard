// A room's number, faint behind the building model, its glyphs nearly as
// tall as the screen (spec model3d/room-navigation). Drawn on a 2D canvas because
// CSS cannot size text by the height of its actual glyphs.

import { el } from './dom';

// Font size the glyphs are measured at before scaling to the screen
const PROBE_PX = 100;
const WEIGHT = 800;
// Share of the screen height the glyphs fill, centred vertically
const HEIGHT_SHARE = 0.9;

export class RoomWatermark {
  readonly element = el('canvas', 'room-watermark');
  private room: string | null = null;

  constructor() {
    this.element.setAttribute('aria-hidden', 'true');
    new ResizeObserver(() => this.draw()).observe(this.element);
  }

  /** Shows `room`, or nothing for null. */
  show(room: string | null): void {
    if (room === this.room) return;
    this.room = room;
    this.draw();
  }

  private draw(): void {
    const canvas = this.element;
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(canvas.clientWidth * ratio);
    const height = Math.round(canvas.clientHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx || this.room === null || width === 0 || height === 0) return;

    const style = getComputedStyle(canvas);
    ctx.font = `${WEIGHT} ${PROBE_PX}px ${style.fontFamily}`;
    const probe = ctx.measureText(this.room);
    const glyphHeight = probe.actualBoundingBoxAscent + probe.actualBoundingBoxDescent;
    if (glyphHeight === 0) return;

    // Glyphs a fixed share of the screen height; squeezed sideways only if they would not fit across it
    const k = (height * HEIGHT_SHARE) / glyphHeight;
    const glyphWidth = (probe.actualBoundingBoxLeft + probe.actualBoundingBoxRight) * k;
    const squeeze = Math.min(1, width / glyphWidth);
    ctx.font = `${WEIGHT} ${PROBE_PX * k}px ${style.fontFamily}`;
    ctx.fillStyle = style.color;
    ctx.translate((width - glyphWidth * squeeze) / 2, (height * (1 - HEIGHT_SHARE)) / 2);
    ctx.scale(squeeze, 1);
    ctx.fillText(this.room, probe.actualBoundingBoxLeft * k, probe.actualBoundingBoxAscent * k);
  }
}
