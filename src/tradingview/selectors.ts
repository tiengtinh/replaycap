/**
 * Centralized TradingView selector map.
 * All DOM selectors live here so future changes require edits in one place.
 *
 * Selector priority:
 *   1. data-qa-* attributes (most stable)
 *   2. aria-label / role
 *   3. Structural CSS path (last resort — update here when TV changes layout)
 */
export const SELECTORS = {
  /**
   * The canvas that renders the LEFT chart pane (1m timeframe in dual layout).
   * This is the canvas we screenshot to find the date badge.
   *
   * ── HOW TO UPDATE ──────────────────────────────────────────────────────────
   * 1. Open TradingView in Chrome with the dual layout active.
   * 2. Right-click the left chart → Inspect.
   * 3. Find the <canvas> element that covers the chart area (not the overlay).
   * 4. Right-click the element in DevTools → Copy → Copy selector.
   * 5. Paste the result as `dateBadgeCanvas` below.
   * ───────────────────────────────────────────────────────────────────────────
   *
   * Last updated: 2026-03-14
   */
  dateBadgeCanvas:
    "#dummybodyid > div.js-rootresizer__contents > div > div.layout__area--center.unselectable > div.chart-container.top-left-chart.active.multiple > div.chart-container-border > div > div.chart-markup-table > div:nth-child(1) > div.chart-markup-table.pane > div > canvas:nth-child(3)",

  /**
   * The top canvas pane for the 5m chart — used for general chart presence detection.
   */
  chartCanvas5m: '[data-qa-id="pane-top-canvas"][aria-label*="5 minutes"]',
  chartCanvasAny: '[data-qa-id="pane-top-canvas"]',

  /**
   * Bar Replay "Next bar" button.
   * Identified by its unique SVG path (step-forward icon) since it has no aria-label.
   */
  nextBarButton: [
    '[data-role="button"]:has(path[d^="M20 6v16"])',
    '[data-role="button"]:has(svg[viewBox="0 0 28 28"] path[fill-rule="evenodd"])',
  ],

  /**
   * Replay toolbar container — used to verify replay mode is active.
   */
  replayToolbar: [
    '[data-name="replay-toolbar"]',
    '[class*="replay-toolbar"]',
    '[class*="replayToolbar"]',
  ],
} as const;
