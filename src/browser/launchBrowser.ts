import { chromium, type BrowserContext } from "playwright";
import type { AppConfig } from "../types.js";
import { logger } from "../utils/logger.js";

/**
 * Launches Chromium in headed mode with a persistent user profile.
 * The persistent profile keeps TradingView logged in across runs.
 */
export async function launchBrowser(config: AppConfig): Promise<BrowserContext> {
  const { userDataDir, viewport } = config.browser;

  logger.info({ userDataDir }, "Launching Chromium with persistent profile");

  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    viewport,
    args: [
      "--disable-blink-features=AutomationControlled",
      "--no-first-run",
      "--no-default-browser-check",
    ],
  });

  logger.info("Browser launched");
  return context;
}
