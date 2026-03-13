import type { Page, ElementHandle } from "playwright";
import { SELECTORS } from "./selectors.js";
import { logger } from "../utils/logger.js";

/**
 * Locates the chart canvas element on the page.
 * Tries the 5m-specific selector first, then falls back to any chart canvas.
 * Throws if no canvas is found — the page is not in a usable state.
 */
export async function findChartCanvas(
  page: Page
): Promise<ElementHandle<Element>> {
  // Try specific 5m canvas first
  const specific = await page.$(SELECTORS.chartCanvas5m);
  if (specific) {
    logger.info({ selector: SELECTORS.chartCanvas5m }, "Found 5m chart canvas");
    return specific;
  }

  // Fallback: any chart canvas
  const any = await page.$(SELECTORS.chartCanvasAny);
  if (any) {
    logger.warn(
      { selector: SELECTORS.chartCanvasAny },
      "5m canvas not found — using generic chart canvas"
    );
    return any;
  }

  throw new Error(
    "No chart canvas found. Ensure TradingView is open with VN301! dual layout."
  );
}
