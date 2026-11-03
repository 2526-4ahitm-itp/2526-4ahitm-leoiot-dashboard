// The two chart instances and their link. ECharts itself is injected (see echartsApi.ts), so that
// tests can check the wiring without a browser.
import { airOption, CHART_GROUP, temperatureOption, type ChartInput } from '../core/chartOptions';

export interface ChartInstance {
  group: string;
  setOption(option: unknown, notMerge?: boolean): void;
  resize(): void;
  dispose(): void;
}

export interface EchartsApi {
  init(el: HTMLElement): ChartInstance;
  connect(group: string): void;
}

export interface Charts {
  render(input: ChartInput): void;
  resize(): void;
  dispose(): void;
}

/** Both charts join one group and are connected: a pointer in any of the three panels marks all three. */
export function createCharts(api: EchartsApi, tempEl: HTMLElement, airEl: HTMLElement): Charts {
  const temp = api.init(tempEl);
  const air = api.init(airEl);
  temp.group = CHART_GROUP;
  air.group = CHART_GROUP;
  api.connect(CHART_GROUP);
  return {
    render(input) {
      temp.setOption(temperatureOption(input), true);
      air.setOption(airOption(input), true);
    },
    resize() {
      temp.resize();
      air.resize();
    },
    dispose() {
      temp.dispose();
      air.dispose();
    },
  };
}
