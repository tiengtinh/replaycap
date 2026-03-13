import type { Page } from "playwright";
import { hashImage } from "./hashImage.js";
import { sleep } from "../utils/sleep.js";
import { logger } from "../utils/logger.js";

/**
 * Polls screenshots until the image hash changes from the baseline.
 * Returns when a visual change is detected.
 *
 * Throws if no change is detected within `timeoutMs`.
 */
export async function waitForVisualChange(
  page: Page,
  opts: {
    baselineHash: string;
    pollMs: number;
    timeoutMs: number;
    barIndex: number;
  }
): Promise<string> {
  const { baselineHash, pollMs, timeoutMs, barIndex } = opts;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    await sleep(pollMs);
    const buf = await page.screenshot({ fullPage: false });
    const hash = hashImage(buf);
    if (hash !== baselineHash) {
      logger.info({ barIndex }, "Visual change detected");
      return hash;
    }
  }

  throw new Error(
    `waitForVisualChange: no change detected within ${timeoutMs}ms for bar ${barIndex}`
  );
}
