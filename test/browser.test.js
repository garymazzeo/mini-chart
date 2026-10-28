import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { chromium } from 'playwright';
import { chartCss, PALETTE } from '../core.js';

const require = createRequire(import.meta.url);
const root = resolve(import.meta.dirname, '..');
const chromePath = process.env.CHROME_BIN || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const axePath = require.resolve('axe-core/axe.min.js');

async function bundle(entry) {
  const result = await build({
    entryPoints: [resolve(root, entry)],
    bundle: true,
    write: false,
    platform: 'browser',
    format: 'iife',
    target: ['chrome120'],
    jsx: 'automatic',
    define: { 'process.env.NODE_ENV': '"production"' },
  });
  return result.outputFiles[0].text;
}

function summary(figure) {
  const svg = figure.querySelector('svg');
  return {
    caption: figure.querySelector('figcaption')?.textContent ?? '',
    title: svg.querySelector('title')?.textContent ?? '',
    description: svg.querySelector('desc')?.textContent ?? '',
    role: svg.getAttribute('role'),
    roleDescription: svg.getAttribute('aria-roledescription'),
    chartType: svg.getAttribute('data-chart-type'),
    points: [...svg.querySelectorAll('[data-point-category]')].map((point) => [
      point.getAttribute('data-point-category'), point.getAttribute('data-point-series'),
    ]),
    rows: [...figure.querySelectorAll('table tr')].map((row) => [...row.children].map((cell) => cell.textContent)),
  };
}

test('web and React renderers meet accessibility and interaction requirements', { timeout: 120_000 }, async (t) => {
  const browser = await chromium.launch({
    headless: true,
    ...(existsSync(chromePath) ? { executablePath: chromePath } : {}),
  });
  try {
    const page = await browser.newPage({ viewport: { width: 900, height: 900 }, colorScheme: 'light' });
    await page.setContent(`<!doctype html>
      <html lang="en"><head><meta charset="utf-8"><title>mini-chart accessibility test</title><style>
        :root{color-scheme:light dark;--mc-color-2:#4c78a8}@media(prefers-color-scheme:dark){:root{--mc-color-2:#d55e00}}*{box-sizing:border-box}html,body{margin:0;padding:0;background:Canvas;color:CanvasText;font:16px/1.5 system-ui,sans-serif}
        main{width:100%;max-width:640px;margin:0 auto;padding:12px}mini-chart{display:block;width:100%;margin:12px 0}
      </style></head><body><main>
        <mini-chart id="web-bar" type="bar" caption="Monthly revenue" table="visible" aria-label="Fallback label"></mini-chart>
        <mini-chart id="web-line" type="line" caption="Monthly visitors" description="Visitor and signup counts for each month."></mini-chart>
        <mini-chart id="web-pie" type="pie" caption="Traffic sources" description="Share of visits from each source." table="none"></mini-chart>
        <mini-chart id="web-horizontal" type="horizontal-bar" caption="Revenue by region" description="Regional revenue and costs." table="hidden"></mini-chart>
        <mini-chart id="host-label" type="bar" aria-label="Revenue chart name" interactive="false"></mini-chart>
        <span id="outside-name">Chart labelled from outside</span><mini-chart id="host-labelledby" type="bar" aria-labelledby="outside-name" interactive="false"></mini-chart>
        <section id="react-fixture"></section>
      </main></body></html>`);

    const [webBundle, reactBundle] = await Promise.all([
      bundle('test/fixtures/web-entry.js'),
      bundle('test/fixtures/react-demo.jsx'),
    ]);
    await page.addScriptTag({ content: webBundle });
    await page.evaluate(() => {
      const data = {
        labels: ['Jan', 'Feb', 'Mar'],
        series: [{ name: 'Revenue', values: [20, 40, 90] }, { name: 'Costs', values: [6, 4, 12] }],
      };
      document.querySelector('#web-bar').data = data;
      document.querySelector('#web-horizontal').data = { labels: ['North', 'South', 'East'], series: data.series };
      document.querySelector('#web-line').data = data;
      document.querySelector('#host-label').data = data;
      document.querySelector('#host-labelledby').data = data;
      document.querySelector('#web-pie').data = { labels: ['Search', 'Direct', 'Social'], series: [{ values: [46, 34, 20] }] };
    });
    await page.addScriptTag({ content: reactBundle });
    await page.waitForFunction(() => document.querySelectorAll('#react-fixture figure').length === 4
      && [...document.querySelectorAll('mini-chart')].every((element) => element.shadowRoot.querySelector('figure')));
    await page.addScriptTag({ path: axePath });

    await t.test('all chart types pass axe WCAG 2.2 AA in light and dark mode', async () => {
      for (const colorScheme of ['light', 'dark']) {
        await page.emulateMedia({ colorScheme });
        const result = await page.evaluate(async () => window.axe.run(document, {
          runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] },
        }));
        assert.deepEqual(result.violations.map(({ id, impact, description, nodes }) => ({ id, impact, description, nodes: nodes.map(({ target, failureSummary }) => ({ target, failureSummary })) })), [], `${colorScheme} mode axe violations`);
      }
    });

    await t.test('IDs are unique and all SVG name/description references resolve locally', async () => {
      const check = await page.evaluate(() => {
        const svgRoots = [
          ...[...document.querySelectorAll('mini-chart')].map((host) => host.shadowRoot.querySelector('svg')),
          ...document.querySelectorAll('#react-fixture svg'),
        ];
        const ids = svgRoots.flatMap((svg) => [...svg.querySelectorAll('[id]')].map((node) => node.id));
        return {
          unique: ids.length === new Set(ids).size,
          refs: svgRoots.map((svg) => [svg.getAttribute('aria-labelledby'), svg.getAttribute('aria-describedby')].every((ref) => ref?.split(/\s+/).every((id) => svg.querySelector(`#${CSS.escape(id)}`)))),
          figureRefs: [...document.querySelectorAll('mini-chart')].map((host) => {
            const figure = host.shadowRoot.querySelector('figure');
            const labelledby = figure.getAttribute('aria-labelledby');
            return labelledby
              ? labelledby.split(/\s+/).every((id) => figure.querySelector(`#${CSS.escape(id)}`))
              : Boolean(figure.getAttribute('aria-label'));
          }),
          hostLabel: document.querySelector('#host-label').shadowRoot.querySelector('figure').getAttribute('aria-label'),
          hostLabelledby: document.querySelector('#host-labelledby').shadowRoot.querySelector('figure').getAttribute('aria-labelledby'),
          localLabelText: document.querySelector('#host-labelledby').shadowRoot.querySelector('.mc-host-label')?.textContent,
          captionWins: document.querySelector('#web-bar').shadowRoot.querySelector('figure').getAttribute('aria-labelledby')
            === document.querySelector('#web-bar').shadowRoot.querySelector('figcaption').id,
          requestedPrefixApplied: [...document.querySelectorAll('#react-fixture svg title')]
            .some((title) => title.id.startsWith('shared-requested-prefix-')),
          modeMatrix: [...svgRoots].map((svg) => [svg.getAttribute('data-chart-type'), svg.getAttribute('data-interactive')]),
        };
      });
      assert.equal(check.unique, true);
      assert.ok(check.refs.every(Boolean));
      assert.ok(check.figureRefs.every(Boolean));
      assert.equal(check.hostLabel, 'Revenue chart name');
      assert.match(check.hostLabelledby, /host-label/);
      assert.equal(check.localLabelText, 'Chart labelled from outside');
      assert.equal(check.captionWins, true);
      assert.equal(check.requestedPrefixApplied, true);
      for (const type of ['bar', 'horizontal-bar', 'line', 'pie']) {
        assert.ok(check.modeMatrix.some(([chartType, interactive]) => chartType === type && interactive === 'true'));
        assert.ok(check.modeMatrix.some(([chartType, interactive]) => chartType === type && interactive === 'false'));
      }
      assert.equal(await page.locator('mini-chart svg[tabindex="0"]').count(), 4);
      assert.equal(await page.locator('#react-fixture svg[tabindex="0"]').count(), 1);
    });

    await t.test('web and React renderers have equivalent core-generated chart content', async () => {
      const result = await page.evaluate(() => {
        const chartSummary = (figure) => {
          const svg = figure.querySelector('svg');
          return {
            caption: figure.querySelector('figcaption')?.textContent ?? '',
            title: svg.querySelector('title')?.textContent ?? '',
            description: svg.querySelector('desc')?.textContent ?? '',
            role: svg.getAttribute('role'),
            viewBox: [svg.viewBox.baseVal.width, svg.viewBox.baseVal.height],
            points: [...svg.querySelectorAll('[data-point-category]')].map((p) => [p.dataset.pointCategory, p.dataset.pointSeries]),
            marks: [...svg.querySelectorAll('.mc-bar,.mc-line,.mc-marker')].map((mark) => ({
              tag: mark.localName, class: mark.getAttribute('class'), marker: mark.getAttribute('data-marker'),
              d: mark.getAttribute('d'), x: mark.getAttribute('x'), y: mark.getAttribute('y'),
              width: mark.getAttribute('width'), height: mark.getAttribute('height'),
              cx: mark.getAttribute('cx'), cy: mark.getAttribute('cy'), r: mark.getAttribute('r'),
              fill: mark.getAttribute('fill'), stroke: mark.getAttribute('stroke'), dash: mark.getAttribute('stroke-dasharray'),
            })),
            rows: [...figure.querySelectorAll('table tr')].map((row) => [...row.children].map((cell) => cell.textContent)),
          };
        };
        const web = document.querySelector('#web-bar').shadowRoot.querySelector('figure');
        const react = document.querySelector('#react-fixture figure');
        return [chartSummary(web), chartSummary(react)];
      });
      assert.deepEqual(result[0], result[1]);
    });

    await t.test('CSS custom properties cascade in web and React renderers without redraws', async () => {
      await page.emulateMedia({ colorScheme: 'light' });
      const defaultPaletteColor = await page.evaluate((color) => {
        const probe = document.createElement('span');
        probe.style.color = color;
        document.body.append(probe);
        const resolved = getComputedStyle(probe).color;
        probe.remove();
        return resolved;
      }, PALETTE[0]);
      const defaultStyle = await page.evaluate(() => ({
        barFill: getComputedStyle(document.querySelector('#web-bar').shadowRoot.querySelector('.mc-series.mc-s0 .mc-bar')).fill,
        gridOpacity: getComputedStyle(document.querySelector('#web-line').shadowRoot.querySelector('.mc-grid')).strokeOpacity,
        lineWidth: getComputedStyle(document.querySelector('#web-line').shadowRoot.querySelector('.mc-line')).strokeWidth,
        pointRadius: getComputedStyle(document.querySelector('#web-line').shadowRoot.querySelector('.mc-marker')).getPropertyValue('r'),
        barRadius: getComputedStyle(document.querySelector('#web-bar').shadowRoot.querySelector('.mc-bar')).getPropertyValue('rx'),
        fontSize: getComputedStyle(document.querySelector('#web-line').shadowRoot.querySelector('svg')).fontSize,
        pieGap: getComputedStyle(document.querySelector('#web-pie').shadowRoot.querySelector('.mc-slice')).strokeWidth,
      }));
      assert.equal(defaultStyle.barFill, defaultPaletteColor, 'default palette matches the existing accessible palette');
      assert.equal(defaultStyle.gridOpacity, '0.15');
      assert.equal(defaultStyle.lineWidth, '2px');
      assert.equal(defaultStyle.pointRadius, '3.5px');
      assert.equal(defaultStyle.barRadius, '0px');
      assert.equal(defaultStyle.fontSize, '12px');
      assert.equal(defaultStyle.pieGap, '1.5px');
      const previousDefaults = { gridOpacity: 0.22, lineWidth: 2.5, pointRadius: 4, pieGap: 2 };
      for (const [property, tolerance] of Object.entries({ gridOpacity: 0.071, lineWidth: 0.5, pointRadius: 0.5, pieGap: 0.5 })) {
        assert.ok(Math.abs(Number.parseFloat(defaultStyle[property]) - previousDefaults[property]) <= tolerance,
          `${property} remains within ${tolerance} of the pre-styling computed default`);
      }
      const fillState = () => page.evaluate(() => ({
        web: getComputedStyle(document.querySelector('#web-bar').shadowRoot.querySelector('.mc-series.mc-s1 .mc-bar')).fill,
        react: getComputedStyle(document.querySelector('#react-fixture figure .mc-series.mc-s1 .mc-bar')).fill,
      }));
      const baseFills = await fillState();
      assert.equal(baseFills.web, baseFills.react);
      assert.notEqual(baseFills.web, '');
      const rootPaletteFill = await page.evaluate(() => {
        const probe = document.createElement('span');
        probe.style.color = getComputedStyle(document.documentElement).getPropertyValue('--mc-color-2');
        document.body.append(probe);
        const resolved = getComputedStyle(probe).color;
        probe.remove();
        return resolved;
      });
      assert.equal(baseFills.web, rootPaletteFill, 'a :root --mc-color-2 override reaches series 2 in both renderers');

      await page.evaluate(() => document.querySelector('#web-bar').style.setProperty('--mc-color-2', 'rgb(1, 2, 3)'));
      const scopedFills = await fillState();
      assert.equal(scopedFills.web, 'rgb(1, 2, 3)');
      assert.equal(scopedFills.react, baseFills.react, 'one host style does not leak to another chart');
      await page.evaluate(() => document.querySelector('#web-bar').style.removeProperty('--mc-color-2'));

      await page.evaluate(() => {
        document.documentElement.style.setProperty('--mc-grid-dash', '4 4');
        document.documentElement.style.setProperty('--mc-surface', 'rgb(12, 34, 56)');
      });
      const cssEffects = await page.evaluate(() => ({
        webGrid: getComputedStyle(document.querySelector('#web-line').shadowRoot.querySelector('.mc-grid')).strokeDasharray,
        reactGrid: getComputedStyle(document.querySelectorAll('#react-fixture figure')[1].querySelector('.mc-grid')).strokeDasharray,
        webSlice: getComputedStyle(document.querySelector('#web-pie').shadowRoot.querySelector('.mc-pie-slice')).stroke,
        reactSlice: getComputedStyle(document.querySelectorAll('#react-fixture figure')[3].querySelector('.mc-pie-slice')).stroke,
      }));
      assert.match(cssEffects.webGrid, /4/);
      assert.match(cssEffects.reactGrid, /4/);
      assert.equal(cssEffects.webSlice, 'rgb(12, 34, 56)');
      assert.equal(cssEffects.reactSlice, 'rgb(12, 34, 56)');
      await page.evaluate(() => {
        document.documentElement.style.removeProperty('--mc-grid-dash');
        document.documentElement.style.removeProperty('--mc-surface');
      });

      const paletteColor = await page.evaluate((value) => {
        const probe = document.createElement('span');
        probe.style.color = value;
        document.body.append(probe);
        const resolved = getComputedStyle(probe).color;
        probe.remove();
        return resolved;
      }, PALETTE[5]);
      await page.evaluate((color) => {
        document.documentElement.style.setProperty('--mc-color-1', color);
        document.querySelector('#web-bar').data = {
          labels: ['Jan', 'Feb', 'Mar'],
          series: [{ name: 'Revenue', values: [20, 40, 90] }, { name: 'Costs', values: [6, 4, 12], color: 'var(--mc-color-1)' }],
        };
        window.__setReactColorData();
      }, PALETTE[5]);
      await page.waitForFunction((expected) => getComputedStyle(document.querySelector('#web-bar').shadowRoot.querySelector('.mc-series.mc-s1 .mc-bar')).fill === expected
        && getComputedStyle(document.querySelector('#react-fixture figure .mc-series.mc-s1 .mc-bar')).fill === expected, paletteColor);
      assert.equal((await fillState()).web, paletteColor, 'series data color takes precedence over --mc-color-2 and var(--mc-color-1) resolves');

      await page.evaluate(() => {
        document.querySelector('#web-bar').data = {
          labels: ['Jan', 'Feb', 'Mar'],
          series: [{ name: 'Revenue', values: [20, 40, 90] }, { name: 'Costs', values: [6, 4, 12] }],
        };
        window.__restoreReactData();
        document.documentElement.style.removeProperty('--mc-color-1');
        window.__webSvgBeforeThemeChange = document.querySelector('#web-bar').shadowRoot.querySelector('svg');
        window.__reactSvgBeforeThemeChange = document.querySelector('#react-fixture figure').querySelector('svg');
      });
      const beforeDark = await fillState();
      await page.emulateMedia({ colorScheme: 'dark' });
      const afterDark = await fillState();
      assert.notEqual(afterDark.web, beforeDark.web);
      assert.notEqual(afterDark.react, beforeDark.react);
      assert.equal(await page.evaluate(() => document.querySelector('#web-bar').shadowRoot.querySelector('svg') === window.__webSvgBeforeThemeChange), true);
      assert.equal(await page.evaluate(() => document.querySelector('#react-fixture figure').querySelector('svg') === window.__reactSvgBeforeThemeChange), true);
    });

    await t.test('injectStyles false omits inline CSS and accepts the exported stylesheet', async () => {
      const noStylePage = await browser.newPage({ viewport: { width: 600, height: 500 } });
      try {
        await noStylePage.setContent('<!doctype html><html lang="en"><head><title>external chart CSS</title></head><body><div id="app"></div></body></html>');
        await noStylePage.addScriptTag({ content: await bundle('test/fixtures/react-no-style.jsx') });
        await noStylePage.waitForFunction(() => document.querySelector('#app figure svg .mc-line'));
        assert.equal(await noStylePage.locator('#app style').count(), 0);
        assert.equal(await noStylePage.locator('#app .mc-line').evaluate((line) => getComputedStyle(line).stroke), 'none');
        await noStylePage.addStyleTag({ content: chartCss });
        const after = await noStylePage.locator('#app .mc-line').evaluate((line) => getComputedStyle(line).stroke);
        assert.notEqual(after, 'none');
      } finally {
        await noStylePage.close();
      }
    });

    await t.test('bar series three and above preserve patterned fills', async () => {
      const patternData = {
        labels: ['A'],
        series: Array.from({ length: 4 }, (_, index) => ({ name: `Series ${index + 1}`, values: [index + 1] })),
      };
      await page.evaluate((data) => {
        document.querySelector('#web-bar').data = data;
        window.__setReactPatternData();
      }, patternData);
      await page.waitForFunction(() => {
        const webBar = document.querySelector('#web-bar').shadowRoot.querySelector('.mc-series.mc-s2 .mc-bar');
        const reactBar = document.querySelector('#react-fixture figure .mc-series.mc-s2 .mc-bar');
        return webBar && reactBar && getComputedStyle(webBar).fill.includes('pattern-2') && getComputedStyle(reactBar).fill.includes('pattern-2');
      });
      const patternFills = await page.evaluate(() => [
        getComputedStyle(document.querySelector('#web-bar').shadowRoot.querySelector('.mc-series.mc-s2 .mc-bar')).fill,
        getComputedStyle(document.querySelector('#react-fixture figure .mc-series.mc-s2 .mc-bar')).fill,
      ]);
      assert.ok(patternFills.every((fill) => fill.includes('pattern-2')));
      await page.evaluate(() => {
        document.querySelector('#web-bar').data = {
          labels: ['Jan', 'Feb', 'Mar'],
          series: [{ name: 'Revenue', values: [20, 40, 90] }, { name: 'Costs', values: [6, 4, 12] }],
        };
        window.__restoreReactData();
      });
    });

    await t.test('keyboard, hover/touch tooltip, Escape, and updates preserve focus', async () => {
      const svg = page.locator('#web-bar').locator('svg');
      await page.evaluate(() => document.activeElement?.blur());
      await page.keyboard.press('Tab');
      assert.equal(await page.evaluate(() => document.activeElement?.id === 'web-bar'
        && document.querySelector('#web-bar').shadowRoot.activeElement?.localName === 'svg'), true);
      const initialFocusRing = await page.evaluate(() => {
        const svg = document.querySelector('#web-bar').shadowRoot.querySelector('svg');
        const ring = svg.querySelector('.mc-svg-focus-dark');
        return { exists: Boolean(ring), opacity: ring ? getComputedStyle(ring).opacity : '0' };
      });
      assert.deepEqual(initialFocusRing, { exists: true, opacity: '1' }, 'Tab focus has an authored visible indicator before any point is active');
      await page.keyboard.press('Tab');
      assert.equal(await page.evaluate(() => document.activeElement?.id === 'web-line'
        && document.querySelector('#web-line').shadowRoot.activeElement?.localName === 'svg'), true);
      await svg.focus();
      await page.keyboard.press('ArrowRight');
      const live = page.locator('#web-bar').locator('.mc-live-region');
      await page.waitForFunction(() => document.querySelector('#web-bar').shadowRoot.querySelector('.mc-live-region').textContent === 'Revenue, Jan: 20');
      await page.keyboard.press('ArrowRight');
      await page.waitForFunction(() => document.querySelector('#web-bar').shadowRoot.querySelector('.mc-live-region').textContent === 'Revenue, Feb: 40');
      assert.equal(await page.locator('#web-bar').locator('.mc-tooltip').count(), 1);
      await page.locator('#web-bar').locator('.mc-tooltip').hover();
      assert.equal(await page.locator('#web-bar').locator('.mc-tooltip').count(), 1, 'tooltip persists while hovered');

      const originalSvg = await svg.elementHandle();
      await page.evaluate(() => {
        document.querySelector('#web-bar').data = { labels: ['Apr'], series: [{ name: 'Revenue', values: [35] }] };
      });
      await page.waitForFunction(() => document.querySelector('#web-bar').shadowRoot.querySelector('.mc-live-region').textContent === 'Revenue, Apr: 35');
      assert.equal(await svg.evaluate((element, oldElement) => element === oldElement, originalSvg), true, 'custom element keeps the focused SVG node');
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('#web-bar').locator('.mc-tooltip').count(), 0);
      assert.equal(await live.textContent(), '');

      const reactSvg = page.locator('#react-fixture figure').first().locator('svg');
      await reactSvg.focus();
      await page.keyboard.press('ArrowRight');
      await page.keyboard.press('ArrowRight');
      await page.keyboard.press('ArrowRight');
      await page.waitForFunction(() => document.querySelector('#react-fixture .mc-live-region').textContent === 'Revenue, Mar: 90');
      const reactHandle = await reactSvg.elementHandle();
      await page.evaluate(() => window.__updateReactData());
      await page.waitForFunction(() => document.querySelector('#react-fixture .mc-live-region').textContent === 'Revenue, Apr: 35');
      assert.equal(await reactSvg.evaluate((element, oldElement) => element === oldElement, reactHandle), true, 'React keeps focus on the SVG across state updates');
      assert.equal(await page.evaluate(() => document.activeElement === document.querySelector('#react-fixture svg')), true);
      await page.keyboard.press('Escape');
      assert.equal(await page.locator('#react-fixture').locator('.mc-tooltip').count(), 0);

      await page.evaluate(() => {
        const point = document.querySelector('#web-pie').shadowRoot.querySelector('[data-point-category="1"]');
        point.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerType: 'touch' }));
      });
      await page.waitForFunction(() => document.querySelector('#web-pie').shadowRoot.querySelector('.mc-live-region').textContent === 'Direct: 34, 34%');
      assert.equal(await page.locator('#web-pie').locator('.mc-tooltip').count(), 1, 'touch pointerdown opens the same tooltip');
    });

    await t.test('charts reflow at 320px and forced-colors CSS applies', async () => {
      await page.setViewportSize({ width: 320, height: 900 });
      await page.waitForTimeout(100);
      const narrow = await page.evaluate(() => ({
        viewport: document.documentElement.clientWidth,
        scroll: document.documentElement.scrollWidth,
        figure: document.querySelector('#web-line').shadowRoot.querySelector('figure').getBoundingClientRect().width,
        viewBoxWidth: document.querySelector('#web-line').shadowRoot.querySelector('svg').viewBox.baseVal.width,
      }));
      assert.ok(narrow.scroll <= narrow.viewport, `page overflows at 320px: ${JSON.stringify(narrow)}`);
      assert.ok(narrow.figure <= 320);
      assert.ok(Math.abs(narrow.viewBoxWidth - narrow.figure) < 1, `viewBox should match measured width: ${JSON.stringify(narrow)}`);
      await page.emulateMedia({ forcedColors: 'active' });
      const forcedColors = await page.evaluate(() => {
        const inspect = (chart) => {
          const lines = Array.from(chart.querySelectorAll('.mc-line'));
          return {
            text: getComputedStyle(chart.querySelector('.mc-axis-label')).fill,
            canvasText: getComputedStyle(document.body).color,
            grid: getComputedStyle(chart.querySelector('.mc-grid:not(.mc-baseline)')).stroke,
            lineStrokes: lines.slice(0, 2).map((line) => getComputedStyle(line).stroke),
            lineDashes: lines.slice(0, 2).map((line) => getComputedStyle(line).strokeDasharray),
            markerShapes: [0, 1].map((series) => chart.querySelector(`.mc-series.mc-s${series} .mc-marker`)?.getAttribute('data-marker')),
            markerFills: [0, 1].map((series) => getComputedStyle(chart.querySelector(`.mc-series.mc-s${series} .mc-marker`)).fill),
          };
        };
        const systemStroke = (value) => {
          const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
          const probe = document.createElementNS('http://www.w3.org/2000/svg', 'line');
          probe.style.stroke = value;
          svg.append(probe);
          document.body.append(svg);
          const resolved = getComputedStyle(probe).stroke;
          svg.remove();
          return resolved;
        };
        const systemFill = (value) => {
          const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
          const probe = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
          probe.style.fill = value;
          svg.append(probe);
          document.body.append(svg);
          const resolved = getComputedStyle(probe).fill;
          svg.remove();
          return resolved;
        };
        return {
          system: { grayText: systemStroke('GrayText'), buttonTextStroke: systemStroke('ButtonText'), buttonTextFill: systemFill('ButtonText') },
          web: inspect(document.querySelector('#web-line').shadowRoot),
          react: inspect(document.querySelectorAll('#react-fixture figure')[1]),
        };
      });
      for (const renderer of ['web', 'react']) {
        assert.equal(forcedColors[renderer].text, forcedColors[renderer].canvasText, `${renderer} text uses CanvasText`);
        assert.equal(forcedColors[renderer].grid, forcedColors.system.grayText, `${renderer} grid uses GrayText`);
        assert.ok(forcedColors[renderer].lineStrokes.every((stroke) => stroke === forcedColors.system.buttonTextStroke), `${renderer} series strokes use ButtonText`);
        assert.ok(forcedColors[renderer].markerFills.every((fill) => fill === forcedColors.system.buttonTextFill), `${renderer} markers use ButtonText`);
        assert.notEqual(forcedColors[renderer].lineDashes[0], forcedColors[renderer].lineDashes[1], `${renderer} series remain distinguishable by dash`);
        assert.notEqual(forcedColors[renderer].markerShapes[0], forcedColors[renderer].markerShapes[1], `${renderer} series remain distinguishable by marker shape`);
      }
    });

    await t.test('assembled demo.html renders its three table modes and controls', async () => {
      const demoPage = await browser.newPage({ viewport: { width: 800, height: 900 } });
      const pageErrors = [];
      demoPage.on('pageerror', (error) => pageErrors.push(error.message));
      try {
        await demoPage.goto(pathToFileURL(resolve(root, 'demo.html')).href);
        await demoPage.waitForFunction(() => ['revenue', 'regions', 'visitors', 'sources'].every((id) => document.querySelector(`#${id}`)?.shadowRoot?.querySelector('svg')));
        assert.equal(await demoPage.locator('#revenue').locator('table').count(), 1);
        assert.equal(await demoPage.locator('#visitors').locator('table').getAttribute('class'), 'mc-data-table mc-table-hidden');
        assert.match(await demoPage.locator('#visitors').locator('table').evaluate((table) => getComputedStyle(table).clip), /rect/);
        assert.equal(await demoPage.locator('#sources').locator('table').count(), 0);
        assert.equal(await demoPage.locator('#regions').locator('svg').getAttribute('data-chart-type'), 'horizontal-bar');
        assert.equal(await demoPage.locator('#revenue').locator('figcaption').textContent(), 'Monthly revenue');
        await demoPage.evaluate(() => { window.__demoSvgBeforeThemeChange = document.querySelector('#regions').shadowRoot.querySelector('svg'); });
        const defaultPalette = await demoPage.locator('#regions .mc-series.mc-s0 .mc-bar').first().evaluate((bar) => getComputedStyle(bar).fill);
        await demoPage.locator('#theme').selectOption('brand');
        const brandedPalette = await demoPage.locator('#regions .mc-series.mc-s0 .mc-bar').first().evaluate((bar) => getComputedStyle(bar).fill);
        assert.notEqual(brandedPalette, defaultPalette, 'theme control changes --mc-color-1 referenced by the data color');
        assert.equal(await demoPage.evaluate(() => document.querySelector('#regions').shadowRoot.querySelector('svg') === window.__demoSvgBeforeThemeChange), true, 'theme switch does not rebuild the chart');
        await demoPage.locator('#grid-style').selectOption('dashed');
        assert.match(await demoPage.locator('#visitors .mc-grid').first().evaluate((line) => getComputedStyle(line).strokeDasharray), /4/);
        await demoPage.locator('#theme').selectOption('high-contrast');
        assert.equal(await demoPage.evaluate(() => document.documentElement.style.getPropertyValue('--mc-grid-opacity')), '0.5');
        await demoPage.locator('#randomize').click();
        assert.deepEqual(pageErrors, []);
      } finally {
        await demoPage.close();
      }

      const reactDemoPage = await browser.newPage({ viewport: { width: 800, height: 900 } });
      const reactErrors = [];
      reactDemoPage.on('pageerror', (error) => reactErrors.push(error.message));
      try {
        await reactDemoPage.setContent('<!doctype html><html lang="en"><head><title>mini-chart React demo test</title></head><body><div id="app"></div></body></html>');
        await reactDemoPage.evaluate(() => {
          document.documentElement.style.setProperty('--mc-color-1', 'rgb(3, 4, 5)');
          document.documentElement.style.setProperty('--mc-color-2', 'rgb(1, 2, 3)');
          document.documentElement.style.setProperty('--mc-grid-dash', '2 2');
        });
        await reactDemoPage.addScriptTag({ content: await bundle('test/fixtures/assembled-page.jsx') });
        await reactDemoPage.waitForFunction(() => document.querySelector('#app figure .mc-live-region'));
        await reactDemoPage.evaluate(() => { window.__reactDemoSvgBeforeThemeChange = document.querySelector('#app figure svg'); });
        const reactDefaultPalette = await reactDemoPage.locator('#app figure .mc-series.mc-s0 .mc-bar').first().evaluate((bar) => getComputedStyle(bar).fill);
        await reactDemoPage.locator('#theme').selectOption('brand');
        const reactBrandedPalette = await reactDemoPage.locator('#app figure .mc-series.mc-s0 .mc-bar').first().evaluate((bar) => getComputedStyle(bar).fill);
        assert.notEqual(reactBrandedPalette, reactDefaultPalette, 'React theme control changes --mc-color-1 through the cascade');
        assert.equal(await reactDemoPage.evaluate(() => document.querySelector('#app figure svg') === window.__reactDemoSvgBeforeThemeChange), true, 'React theme switch does not rebuild the chart');
        await reactDemoPage.locator('#grid-style').selectOption('dashed');
        assert.match(await reactDemoPage.locator('#app figure .mc-grid').first().evaluate((line) => getComputedStyle(line).strokeDasharray), /4/);
        const tableMode = reactDemoPage.locator('button').filter({ hasText: 'Table mode:' });
        assert.equal(await reactDemoPage.locator('#app figure table').count(), 1);
        await tableMode.click();
        assert.equal(await reactDemoPage.locator('#app figure table').getAttribute('class'), 'mc-data-table mc-table-visible');
        await tableMode.click();
        assert.equal(await reactDemoPage.locator('#app figure table').count(), 0, 'none mode omits the table');
        assert.ok(await reactDemoPage.locator('#app figure svg desc').textContent());
        await reactDemoPage.getByRole('button', { name: 'pie' }).click();
        assert.equal(await reactDemoPage.locator('#app figure svg').getAttribute('data-chart-type'), 'pie');
        await reactDemoPage.getByRole('button', { name: 'horizontal-bar' }).click();
        assert.equal(await reactDemoPage.locator('#app figure svg').getAttribute('data-chart-type'), 'horizontal-bar');
        await reactDemoPage.setViewportSize({ width: 320, height: 900 });
        await reactDemoPage.waitForTimeout(100);
        const reflow = await reactDemoPage.evaluate(() => ({
          viewport: document.documentElement.clientWidth,
          scroll: document.documentElement.scrollWidth,
          main: document.querySelector('#app main').getBoundingClientRect().width,
        }));
        assert.ok(reflow.scroll <= reflow.viewport, `React demo overflows at 320px: ${JSON.stringify(reflow)}`);
        assert.ok(reflow.main <= 320);
        await reactDemoPage.evaluate(() => window.__pageRoot.unmount());
        const restoredStyle = await reactDemoPage.evaluate(() => ({
          palette: document.documentElement.style.getPropertyValue('--mc-color-1'),
          color: document.documentElement.style.getPropertyValue('--mc-color-2'),
          grid: document.documentElement.style.getPropertyValue('--mc-grid-dash'),
        }));
        assert.deepEqual(restoredStyle, { palette: 'rgb(3, 4, 5)', color: 'rgb(1, 2, 3)', grid: '2 2' }, 'unmount restores existing inline theme variables');
        assert.deepEqual(reactErrors, []);
      } finally {
        await reactDemoPage.close();
      }
    });
  } finally {
    await browser.close();
  }
});
