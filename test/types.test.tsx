import { Chart, type ChartProps } from '../MiniChart';
import type { MiniChartElement } from '../mini-chart.js';

const chartOptions: ChartProps = {
  type: 'horizontal-bar',
  data: { labels: ['Jan'], series: [{ values: [3] }] },
  idPrefix: 'revenue-chart',
  gridStyle: 'dashed',
  fontSize: 14,
};

export const typedChart = <Chart {...chartOptions} />;

declare const typedElement: MiniChartElement;
typedElement.colors = ['var(--consumer-color, #0072b2)'];
typedElement.gridStyle = 'dashed';
typedElement.fontSize = 14;
