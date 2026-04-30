import type { Page } from "playwright";
import fsExtra from "fs-extra";
const { ensureDir } = fsExtra;
import path from "path";
import { logger } from "../utils/logger.js";

/**
 * Captures a viewport screenshot and saves it to `filePath`.
 * Creates intermediate directories as needed.
 *
 * fullPage is intentionally false: TradingView's document scroll area exceeds
 * the visible viewport, so fullPage: true produces oversized images with gray
 * padding outside the chart UI. Capturing the viewport only gives the correct
 * pixel-exact frame.
 */
export async function saveScreenshot(
  page: Page,
  filePath: string
): Promise<void> {
  await ensureDir(path.dirname(filePath));
  await page.screenshot({ path: filePath, fullPage: false });
  logger.info({ filePath }, "Screenshot saved");
}
