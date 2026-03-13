import type { Page } from "playwright";
import { hashImage } from "./hashImage.js";
import { sleep } from "../utils/sleep.js";
import { logger } from "../utils/logger.js";

/**
 * Polls screenshots until `stableFrames` consecutive captures produce the same hash.
 * Returns the stable hash when settled.
 *
 * Throws if the frame does not stabilize within `timeoutMs`.
 */
export async function waitForStableFrame(
  page: Page,
  opts: {
    pollMs: number;
    stableFrames: number;
    timeoutMs: number;
    barIndex: number;
  }
): Promise<string> {
  const { pollMs, stableFrames, timeoutMs, barIndex } = opts;
  const deadline = Date.now() + timeoutMs;

  let consecutiveMatches = 0;
  let lastHash = "";

  while (Date.now() < deadline) {
    await sleep(pollMs);
    const buf = await page.screenshot({ fullPage: false });
    const hash = hashImage(buf);

    if (hash === lastHash) {
      consecutiveMatches++;
      if (consecutiveMatches >= stableFrames) {
        logger.info(
          { barIndex, stableFrames, hash: hash.slice(0, 8) },
          "Frame stable"
        );
        return hash;
      }
    } else {
      consecutiveMatches = 1;
      lastHash = hash;
    }
  }

  logger.warn(
    { barIndex, timeoutMs },
    "Frame did not fully stabilize — using last captured hash"
  );
  return lastHash;
}
