// A fixed legend on the right listing the active route's markers, each
// colour-matched to its dot on the route itself (spec model3d/room-navigation).

import { el } from './dom';

export interface LegendEntry {
  readonly colour: string;
  readonly text: string;
}

export class RouteLegend {
  readonly element = el('div', 'route-legend');

  constructor() {
    this.element.hidden = true;
  }

  /** Replaces the shown entries; hides the legend entirely when there are none. */
  update(entries: readonly LegendEntry[]): void {
    this.element.hidden = entries.length === 0;
    this.element.replaceChildren(
      ...entries.map(({ colour, text }) => {
        const row = el('div', 'route-legend-row');
        const swatch = el('span', 'route-legend-swatch');
        swatch.style.backgroundColor = colour;
        row.append(swatch, el('span', undefined, text));
        return row;
      }),
    );
  }
}
