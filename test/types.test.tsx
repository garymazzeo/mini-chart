import { Chart, type ChartProps } from '../MiniChart';

const chartOptions: ChartProps = {
  type: 'bar',
  data: { labels: ['Jan'], series: [{ values: [3] }] },
  idPrefix: 'revenue-chart',
};

export const typedChart = <Chart {...chartOptions} />;
