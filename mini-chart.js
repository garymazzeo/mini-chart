// mini-chart.js — <mini-chart> custom element. Converts the core's tree into DOM nodes.
import { buildChart } from './core.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

function toDOM(node) {
  if (typeof node === 'string') return document.createTextNode(node);
  const el = document.createElementNS(SVG_NS, node.tag);
  for (const [k, v] of Object.entries(node.attrs)) el.setAttribute(k, v);
  for (const c of node.children) el.append(toDOM(c));
  return el;
}

class MiniChart extends HTMLElement {
  static observedAttributes = ['type', 'width', 'height', 'data'];
  #data = null;
  #queued = false;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' }).innerHTML = '<style>:host{display:block}</style>';
  }

  // Set rich data via property: el.data = { labels, series }
  get data() { return this.#data; }
  set data(v) { this.#data = v; this.#schedule(); }

  connectedCallback() { this.#schedule(); }
  attributeChangedCallback() { this.#schedule(); }

  // Coalesce multiple changes in the same tick into one render.
  #schedule() {
    if (this.#queued) return;
    this.#queued = true;
    queueMicrotask(() => { this.#queued = false; this.#render(); });
  }

  #render() {
    let data = this.#data;
    if (!data && this.hasAttribute('data')) {
      try { data = JSON.parse(this.getAttribute('data')); } catch { /* ignore bad JSON */ }
    }
    const tree = buildChart({
      type: this.getAttribute('type') ?? 'bar',
      data,
      width: Number(this.getAttribute('width')) || undefined,
      height: Number(this.getAttribute('height')) || undefined,
    });
    this.shadowRoot.querySelector('svg')?.remove();
    this.shadowRoot.append(toDOM(tree));
  }
}

customElements.define('mini-chart', MiniChart);

// Usage:
// <script type="module" src="./mini-chart.js"></script>
// <mini-chart type="bar" id="c"></mini-chart>
// <script>c.data = { labels: ['A','B','C'], series: [{ name: 'Sales', values: [4, 9, 6] }] }</script>
