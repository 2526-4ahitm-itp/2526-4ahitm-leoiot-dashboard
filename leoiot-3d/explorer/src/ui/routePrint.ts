// The printed form of the active route: one section per floor in the order
// the route walks them, each with its numbered turns and stairs and, unless
// the floor is only passed straight through between two stairs, a picture of
// that floor's part of the route (spec model3d/room-navigation, "The active
// route can be printed"). Only visible on paper, see styles.css.

import { el } from './dom';

export interface PrintFloor {
  readonly title: string;
  /** A picture of the floor with its part of the route, as a data URL — omitted for a floor the route only passes straight through between two stairs, nothing on it worth a picture. */
  readonly image: string | null;
  readonly steps: readonly string[];
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
        const picture = image === null ? null : el('img', 'route-print-image');
        if (picture) {
          picture.src = image!;
          picture.alt = title;
        }
        const list = el('ol', 'route-print-steps');
        list.start = step + 1;
        list.append(
          ...steps.map((text) => {
            step++;
            return el('li', 'route-print-step', text);
          }),
        );
        floor.append(el('h2', 'route-print-floor-title', title), ...(picture ? [picture] : []), list);
        return floor;
      }),
      el('p', 'route-print-arrival', sheet.arrival),
    );
  }
}
