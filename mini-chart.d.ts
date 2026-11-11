import type { ChartData } from './core.js';

export interface MiniChartElement extends HTMLElement {
  data: ChartData | null;
}

declare global {
  interface HTMLElementTagNameMap {
    'mini-chart': MiniChartElement;
  }
}

export {};
