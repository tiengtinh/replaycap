import type { Page } from "playwright";
import fsExtra from "fs-extra";
const { ensureDir } = fsExtra;
import path from "path";
import { logger } from "../utils/logger.js";

/**
 * Captures a full-page screenshot and saves it to `filePath`.
 * Creates intermediate directories as needed.
 */
export async function saveScreenshot(
  page: Page,
  filePath: string
): Promise<void> {
  await ensureDir(path.dirname(filePath));
  await page.screenshot({ path: filePath, fullPage: true });
  logger.info({ filePath }, "Screenshot saved");
}
