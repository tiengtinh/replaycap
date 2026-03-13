import type { Page, ElementHandle } from "playwright";
import { SELECTORS } from "./selectors.js";
import { logger } from "../utils/logger.js";

/**
 * Locates the "Next bar" replay button by trying each selector in order.
 * Throws if none are found — replay mode must be active.
 */
export async function findNextBarButton(
  page: Page
): Promise<ElementHandle<Element>> {
  for (const selector of SELECTORS.nextBarButton) {
    const el = await page.$(selector);
    if (el) {
      logger.info({ selector }, "Found Next Bar button");
      return el;
    }
  }

  throw new Error(
    "Next Bar button not found. Ensure Bar Replay mode is active in TradingView."
  );
}

/**
 * Checks whether the replay toolbar is visible on the page.
 */
export async function isReplayActive(page: Page): Promise<boolean> {
  for (const selector of SELECTORS.replayToolbar) {
    const el = await page.$(selector);
    if (el) {
      const visible = await el.isVisible();
      if (visible) return true;
    }
  }
  return false;
}
