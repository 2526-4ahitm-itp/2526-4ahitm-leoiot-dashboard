// A fixed legend on the right listing the active route's markers, each
// colour-matched to its dot on the route itself, grouped into one section
// per floor so markers already seen on an earlier floor stay visible and
// clearly separated as more of the route is revealed (spec model3d/room-navigation).
// Its "Print route" button prints the whole route (ui/routePrint.ts).

import { el } from './dom';
import { strings } from './strings';

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
  private readonly sections = el('div', 'route-legend-sections');
  private readonly printButton = el('button', 'button route-legend-print', strings.navigation.print);

  onPrint: () => void = () => undefined;

  constructor() {
    this.element.hidden = true;
    this.printButton.addEventListener('click', () => this.onPrint());
    this.element.append(this.sections, this.printButton);
  }

  /** Replaces the shown sections; hides the legend entirely when no route is active. */
  update(sections: readonly LegendSection[], routeActive: boolean): void {
    this.element.hidden = !routeActive;
    this.sections.hidden = sections.length === 0;
    this.sections.replaceChildren(
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
