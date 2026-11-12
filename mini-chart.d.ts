import type { ChartData, GridStyle } from './core.js';

export interface MiniChartElement extends HTMLElement {
  data: ChartData | null;
  colors: string[] | undefined;
  gridStyle: GridStyle | string;
  fontSize: number;
}

declare global {
  interface HTMLElementTagNameMap {
    'mini-chart': MiniChartElement;
  }
}

export {};
