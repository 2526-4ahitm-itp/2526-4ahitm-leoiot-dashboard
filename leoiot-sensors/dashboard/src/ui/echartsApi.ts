// ECharts 6, imported per module: only what the two charts use.
import { LineChart } from 'echarts/charts';
import { AxisPointerComponent, GraphicComponent, GridComponent, MarkAreaComponent, MarkLineComponent, TooltipComponent } from 'echarts/components';
import * as echarts from 'echarts/core';
import { SVGRenderer } from 'echarts/renderers';
import type { EchartsApi } from './charts';

echarts.use([LineChart, GridComponent, TooltipComponent, AxisPointerComponent, MarkAreaComponent, MarkLineComponent, GraphicComponent, SVGRenderer]);

export const echartsApi: EchartsApi = {
  init: (el) => echarts.init(el, null, { renderer: 'svg' }) as unknown as ReturnType<EchartsApi['init']>,
  connect: (group) => echarts.connect(group),
};
