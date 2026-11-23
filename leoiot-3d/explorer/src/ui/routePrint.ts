// The printed form of the active route: one section per floor in the order
// the route walks them, each with a picture of that floor's route and its
// numbered, colour-matched turns and stairs (spec model3d/room-navigation,
// "The active route can be printed"). Only visible on paper, see styles.css.

import { el } from './dom';
import type { LegendEntry } from './routeLegend';

export interface PrintFloor {
  readonly title: string;
  /** A picture of the floor with its part of the route, as a data URL. */
  readonly image: string;
  readonly steps: readonly LegendEntry[];
}

export interface PrintSheet {
  readonly title: string;
  readonly start: string;
  readonly floors: readonly PrintFloor[];
  readonly arrival: string;
}

export class RoutePrint {
  readonly element = el('section', 'route-print');

  constructor() {
    this.element.hidden = true;
  }

  /** Replaces the printed route; null leaves nothing to print beyond the normal page. */
  update(sheet: PrintSheet | null): void {
    this.element.hidden = sheet === null;
    if (!sheet) {
      this.element.replaceChildren();
      return;
    }
    let step = 0;
    this.element.replaceChildren(
      el('h1', 'route-print-title', sheet.title),
      el('p', 'route-print-start', sheet.start),
      ...sheet.floors.map(({ title, image, steps }) => {
        const floor = el('div', 'route-print-floor');
        const picture = el('img', 'route-print-image');
        picture.src = image;
        picture.alt = title;
        const list = el('ol', 'route-print-steps');
        list.start = step + 1;
        list.append(
          ...steps.map(({ colour, text }) => {
            step++;
            const item = el('li', 'route-print-step');
            const swatch = el('span', 'route-legend-swatch');
            swatch.style.backgroundColor = colour;
            item.append(swatch, el('span', undefined, text));
            return item;
          }),
        );
        floor.append(el('h2', 'route-print-floor-title', title), picture, list);
        return floor;
      }),
      el('p', 'route-print-arrival', sheet.arrival),
    );
  }
}
