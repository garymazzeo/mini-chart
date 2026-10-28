import { Chart, type ChartProps } from '../MiniChart';

const chartOptions: ChartProps = {
  type: 'horizontal-bar',
  data: { labels: ['Jan'], series: [{ values: [3] }] },
  fontSize: 14,
  injectStyles: false,
  idPrefix: 'revenue-chart',
};

export const typedChart = <Chart {...chartOptions} />;
