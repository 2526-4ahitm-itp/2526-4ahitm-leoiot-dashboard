// The three chart instances and their link. ECharts itself is injected (see echartsApi.ts), so that
// tests can check the wiring without a browser.
import { co2Option, CHART_GROUP, humidityOption, temperatureOption, type ChartInput } from '../core/chartOptions';

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

/** The three charts join one group and are connected: a pointer in any of them marks all three. */
export function createCharts(api: EchartsApi, co2El: HTMLElement, tempEl: HTMLElement, humEl: HTMLElement): Charts {
  const all = [api.init(co2El), api.init(tempEl), api.init(humEl)];
  for (const c of all) c.group = CHART_GROUP;
  api.connect(CHART_GROUP);
  const [co2, temp, hum] = all;
  return {
    render(input) {
      co2.setOption(co2Option(input), true);
      temp.setOption(temperatureOption(input), true);
      hum.setOption(humidityOption(input), true);
    },
    resize() {
      for (const c of all) c.resize();
    },
    dispose() {
      for (const c of all) c.dispose();
    },
  };
}
