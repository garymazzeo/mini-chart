# Accessibility notes

## Semantics and interaction

- The core emits a `<figure>` with a visible `<figcaption>` when `caption` is provided, an SVG title and description, and a semantic data table. The table is visually clipped (not `display:none`) by default; `table="visible"` exposes it visually and `table="none"` omits it only when a non-empty `description` is supplied.
- Static charts (`interactive: false`) use `role="img"` with `aria-labelledby` and `aria-describedby`. Interactive charts use a single focusable SVG with `role="group"` and `aria-roledescription="chart"`; a two-layer outline is visible on initial keyboard focus and around the active point. Data marks remain decorative, while axis labels and the legend remain in the tree.
- Interactive movement is announced through a visually hidden polite live region. The implementation intentionally does not use `aria-activedescendant`: support for it on SVG groups is inconsistent, while the stable SVG focus target plus live region works in the browser tests and leaves the table as a complete alternative.
- Arrow keys move across categories and series; Home and End move to category boundaries; Escape clears the active point and tooltip. Hover and touch pointer-down show the same persistent tooltip. Focus remains on the SVG when data is updated.
- The default palette has computed contrast of at least 3:1 against both white and `#14181b`. Line dash patterns, marker shapes, bar hatches beyond two series, and pie slice separators provide non-hue cues. The SVG includes forced-colors CSS using system colors.

## Verification performed

- Node unit tests cover table contents (including missing values and pie percentages), generated ID uniqueness, static/interactive ARIA references, empty charts, keyboard navigation edge cases, and palette contrast ratios.
- Playwright with axe-core checks all chart types in both interaction modes under light and dark color schemes against WCAG 2.2 A/AA rules. The browser suite also checks keyboard navigation, live-region updates, tooltip dismissal/hover/touch behavior, focus preservation and clamping after updates, renderer equivalence, 320px reflow, and forced-colors CSS.
- The assembled `demo.html` is opened in Chromium and its visible/hidden/omitted table modes and randomize control are exercised.

## Manual checklist

| Check | Status |
| --- | --- |
| Keyboard only | Automated arrow/Home/End/Escape and focus-preservation paths passed. A full manual keyboard-only review remains to be done. |
| VoiceOver with Safari | Not run; this environment does not provide a VoiceOver session. |
| NVDA with Firefox or Chrome | Not run; NVDA is Windows-only and this environment is macOS. |
| Browser zoom at 200% | Not run manually. Automated coverage verifies a 320px viewport and no horizontal page overflow, but that is not a substitute for a real 200% browser-zoom check. |
| Forced-colors mode | CSS behavior was checked with Playwright forced-colors emulation; a manual Windows High Contrast review remains to be done. |

Axe and automated interaction tests cannot establish conformance by themselves. Complete the unrun manual checks with assistive technology and real browser zoom before claiming full WCAG 2.2 AA conformance.
