import type { BrowserContext, Page } from "playwright";
import type { AppConfig } from "../types.js";
import { logger } from "../utils/logger.js";

const TV_URL_PATTERN = /tradingview\.com/;

/**
 * Finds an existing TradingView tab in the browser context.
 * If none is found, opens a new tab to the configured URL.
 */
export async function attachTradingViewPage(
  context: BrowserContext,
  config: AppConfig
): Promise<Page> {
  const pages = context.pages();

  for (const page of pages) {
    if (TV_URL_PATTERN.test(page.url())) {
      logger.info({ url: page.url() }, "Found existing TradingView tab");
      return page;
    }
  }

  logger.info(
    { url: config.tradingView.url },
    "No TradingView tab found — opening new tab"
  );
  const page = await context.newPage();
  await page.goto(config.tradingView.url);
  await page.waitForLoadState("domcontentloaded");
  return page;
}
