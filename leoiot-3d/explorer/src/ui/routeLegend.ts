// A fixed legend on the right listing the active route's markers, each
// colour-matched to its dot on the route itself, grouped into one section
// per floor so markers already seen on an earlier floor stay visible and
// clearly separated as more of the route is revealed (spec model3d/room-navigation).

import { el } from './dom';

export interface LegendEntry {
  readonly colour: string;
  readonly text: string;
}

export interface LegendSection {
  readonly title: string;
  readonly entries: readonly LegendEntry[];
}

export class RouteLegend {
  readonly element = el('div', 'route-legend');

  constructor() {
    this.element.hidden = true;
  }

  /** Replaces the shown sections; hides the legend entirely when there are none. */
  update(sections: readonly LegendSection[]): void {
    this.element.hidden = sections.length === 0;
    this.element.replaceChildren(
      ...sections.map(({ title, entries }) => {
        const section = el('div', 'route-legend-section');
        section.append(el('div', 'route-legend-title', title));
        section.append(
          ...entries.map(({ colour, text }) => {
            const row = el('div', 'route-legend-row');
            const swatch = el('span', 'route-legend-swatch');
            swatch.style.backgroundColor = colour;
            row.append(swatch, el('span', undefined, text));
            return row;
          }),
        );
        return section;
      }),
    );
  }
}
