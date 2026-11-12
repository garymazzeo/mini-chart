// mini-chart.js — <mini-chart> custom element. DOM renderer for core.js.
import { buildFigure, clampPoint, nextPoint, pointDimensions, STYLE } from './core.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
let instanceCount = 0;

function createDOM(node, parentNamespace = null) {
  if (typeof node === 'string') return document.createTextNode(node);
  const namespace = node.tag === 'svg' || parentNamespace === SVG_NS ? SVG_NS : null;
  const element = namespace ? document.createElementNS(namespace, node.tag) : document.createElement(node.tag);
  for (const [name, value] of Object.entries(node.attrs)) {
    if (value !== undefined && value !== null) element.setAttribute(name, String(value));
  }
  for (const child of node.children) element.append(createDOM(child, namespace));
  return element;
}

function patchDOM(current, node, parentNamespace = null) {
  if (typeof node === 'string') {
    if (current?.nodeType === Node.TEXT_NODE) {
      if (current.data !== node) current.data = node;
      return current;
    }
    return document.createTextNode(node);
  }

  const namespace = node.tag === 'svg' || parentNamespace === SVG_NS ? SVG_NS : null;
  if (!current || current.nodeType !== Node.ELEMENT_NODE || current.localName !== node.tag || current.namespaceURI !== (namespace ?? 'http://www.w3.org/1999/xhtml')) {
    return createDOM(node, parentNamespace);
  }

  const nextAttributes = new Map(Object.entries(node.attrs).filter(([, value]) => value !== undefined && value !== null).map(([name, value]) => [name, String(value)]));
  for (const attribute of Array.from(current.attributes)) {
    if (!nextAttributes.has(attribute.name)) current.removeAttribute(attribute.name);
  }
  for (const [name, value] of nextAttributes) {
    if (current.getAttribute(name) !== value) current.setAttribute(name, value);
  }

  const existingChildren = Array.from(current.childNodes);
  node.children.forEach((child, index) => {
    const oldChild = existingChildren[index] ?? null;
    const patched = patchDOM(oldChild, child, namespace);
    if (patched !== oldChild) {
      if (oldChild) current.replaceChild(patched, oldChild);
      else current.append(patched);
    }
  });
  while (current.childNodes.length > node.children.length) current.lastChild.remove();
  return current;
}

function pointFromEvent(target) {
  if (!(target instanceof Element)) return null;
  const point = target.closest('[data-point-category][data-point-series]');
  if (!point) return null;
  return {
    category: Number(point.getAttribute('data-point-category')),
    series: Number(point.getAttribute('data-point-series')),
  };
}

if (typeof HTMLElement !== 'undefined' && typeof customElements !== 'undefined') {
class MiniChart extends HTMLElement {
  static observedAttributes = ['type', 'width', 'height', 'data', 'colors', 'grid-style', 'font-size', 'caption', 'description', 'table', 'interactive', 'aria-label', 'aria-labelledby'];
  #data = null;
  #colors = undefined;
  #activePoint = null;
  #queued = false;
  #width = 0;
  #idPrefix = `mini-chart-${++instanceCount}`;
  #resizeObserver = null;

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    root.innerHTML = `<style>:host{display:${STYLE.element.hostDisplay};max-width:${STYLE.element.maxWidth}}.mc-figure{max-width:${STYLE.element.maxWidth}}svg{display:${STYLE.element.svgDisplay};max-width:${STYLE.element.maxWidth};height:${STYLE.element.svgHeight}}</style>`;
    root.addEventListener('keydown', (event) => this.#onKeyDown(event));
    root.addEventListener('pointermove', (event) => this.#onPointer(event));
    root.addEventListener('pointerdown', (event) => this.#onPointer(event));
  }

  // Rich data is assigned as el.data = { labels, series }.
  get data() { return this.#data; }
  set data(value) { this.#data = value; this.#schedule(); }

  get colors() { return this.#readColors(); }
  set colors(value) { this.#colors = Array.isArray(value) ? value : undefined; this.#schedule(); }

  get gridStyle() { return this.getAttribute('grid-style') ?? STYLE.grid.solidStyle; }
  set gridStyle(value) { value == null ? this.removeAttribute('grid-style') : this.setAttribute('grid-style', String(value)); }

  get fontSize() { return Number(this.getAttribute('font-size')) || STYLE.fontSize; }
  set fontSize(value) { value == null ? this.removeAttribute('font-size') : this.setAttribute('font-size', String(value)); }

  connectedCallback() {
    this.#schedule();
    if (typeof ResizeObserver !== 'undefined' && !this.#resizeObserver) {
      this.#resizeObserver = new ResizeObserver((entries) => {
        const nextWidth = Math.round(entries[0]?.contentRect.width ?? 0);
        if (nextWidth > 0 && nextWidth !== this.#width) {
          this.#width = nextWidth;
          this.#schedule();
        }
      });
      this.#resizeObserver.observe(this);
    }
  }

  disconnectedCallback() {
    this.#resizeObserver?.disconnect();
    this.#resizeObserver = null;
  }

  attributeChangedCallback() { this.#schedule(); }

  #readData() {
    if (this.#data) return this.#data;
    if (!this.hasAttribute('data')) return { labels: [], series: [] };
    try { return JSON.parse(this.getAttribute('data')); }
    catch { return { labels: [], series: [] }; }
  }

  #readColors() {
    if (this.#colors !== undefined) return this.#colors;
    if (!this.hasAttribute('colors')) return undefined;
    try {
      const colors = JSON.parse(this.getAttribute('colors'));
      return Array.isArray(colors) ? colors : undefined;
    } catch {
      return undefined;
    }
  }

  #options() {
    const type = this.getAttribute('type') ?? 'bar';
    const data = this.#readData();
    const width = this.#width || Number(this.getAttribute('width')) || STYLE.width;
    const description = this.getAttribute('description') ?? undefined;
    const options = {
      type,
      data,
      width,
      height: Number(this.getAttribute('height')) || STYLE.height,
      colors: this.#readColors(),
      gridStyle: this.getAttribute('grid-style') ?? undefined,
      fontSize: Number(this.getAttribute('font-size')) || undefined,
      caption: this.getAttribute('caption') || undefined,
      description,
      table: this.getAttribute('table') ?? 'hidden',
      interactive: this.getAttribute('interactive') !== 'false',
      idPrefix: this.#idPrefix,
      activePoint: this.#activePoint,
    };
    return { options, data };
  }

  #applyHostName(tree) {
    const figure = tree;
    if (this.hasAttribute('caption') && this.getAttribute('caption')?.trim()) return;
    const labelledby = this.getAttribute('aria-labelledby');
    const label = this.getAttribute('aria-label');
    if (labelledby) {
      const text = labelledby.split(/\s+/)
        .map((id) => document.getElementById(id)?.textContent?.trim())
        .filter(Boolean)
        .join(' ');
      if (text) {
        const id = `${this.#idPrefix}-host-label`;
        figure.attrs['aria-labelledby'] = id;
        figure.children.unshift({
          tag: 'span',
          attrs: {
            id,
            class: 'mc-visually-hidden mc-host-label',
            style: STYLE.table.hiddenStyle,
          },
          children: [text],
        });
      } else {
        figure.attrs['aria-label'] = label || 'Chart';
        delete figure.attrs['aria-labelledby'];
      }
    }
    else if (label) {
      delete figure.attrs['aria-labelledby'];
      figure.attrs['aria-label'] = label;
    }
  }

  #schedule() {
    if (this.#queued) return;
    this.#queued = true;
    queueMicrotask(() => {
      this.#queued = false;
      this.#render();
    });
  }

  #render() {
    const { options, data } = this.#options();
    const dimensions = pointDimensions(options.type, data);
    if (this.#activePoint) {
      this.#activePoint = clampPoint(this.#activePoint, dimensions)
        ?? nextPoint(null, 'ArrowRight', dimensions)
        ?? null;
    }
    options.activePoint = this.#activePoint;
    const tree = buildFigure(options);
    this.#applyHostName(tree);
    const oldFigure = this.shadowRoot.querySelector('figure');
    const patched = patchDOM(oldFigure, tree);
    if (patched !== oldFigure) {
      if (oldFigure) oldFigure.replaceWith(patched);
      else this.shadowRoot.append(patched);
    }
  }

  #onKeyDown(event) {
    const svg = event.target instanceof Element ? event.target.closest('svg') : null;
    if (!svg || svg.getAttribute('data-interactive') !== 'true') return;
    const { options, data } = this.#options();
    const next = nextPoint(this.#activePoint, event.key, pointDimensions(options.type, data));
    if (next === undefined) return;
    event.preventDefault();
    this.#activePoint = next;
    this.#schedule();
  }

  #onPointer(event) {
    const point = pointFromEvent(event.target);
    if (!point || this.getAttribute('interactive') === 'false') return;
    this.#activePoint = point;
    this.#schedule();
  }
}

if (!customElements.get('mini-chart')) customElements.define('mini-chart', MiniChart);
}
