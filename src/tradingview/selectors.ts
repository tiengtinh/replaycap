/**
 * Centralized TradingView selector map.
 * All DOM selectors live here so future changes require edits in one place.
 *
 * Selector priority:
 *   1. data-qa-* attributes (most stable)
 *   2. aria-label / role
 *   3. text content
 */
export const SELECTORS = {
  /**
   * The top canvas pane for the 5m chart in a dual layout.
   * aria-label contains the symbol and timeframe.
   */
  chartCanvas5m: '[data-qa-id="pane-top-canvas"][aria-label*="5 minutes"]',

  /**
   * Any chart canvas — used for general chart presence detection.
   */
  chartCanvasAny: '[data-qa-id="pane-top-canvas"]',

  /**
   * Bar Replay "Next bar" button.
   * TradingView uses a data-name attribute on the replay toolbar buttons.
   * Fallback selectors are listed in order of reliability.
   */
  nextBarButton: [
    '[data-name="replay-step-forward"]',
    'button[aria-label*="Next bar"]',
    'button[aria-label*="next bar"]',
    'button[title*="Next bar"]',
    'button[title*="next bar"]',
  ],

  /**
   * The date badge shown at the bottom-right of the chart during replay.
   * This is the primary source for the current replay date.
   *
   * Multiple candidates — the correct one will contain text like "2026-03-13".
   */
  dateBadge: [
    '[data-qa-id="replay-current-date"]',
    ".chart-controls-bar .date",
    ".replay-toolbar [class*=date]",
    // Generic fallback: element near bottom of chart containing a date pattern
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
