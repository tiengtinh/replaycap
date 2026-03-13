import type { Page } from "playwright";
import { findNextBarButton } from "./findReplayControls.js";
import { logger } from "../utils/logger.js";
import { sleep } from "../utils/sleep.js";

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 500;

/**
 * Advances the replay by one bar.
 * Retries once on click failure before throwing.
 */
export async function stepNextBar(
  page: Page,
  barIndex: number
): Promise<void> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const btn = await findNextBarButton(page);
      await btn.click();
      logger.info({ barIndex, attempt }, "Clicked Next Bar");
      return;
    } catch (err) {
      lastError = err;
      logger.warn(
        { barIndex, attempt, error: String(err) },
        "Next Bar click failed — retrying"
      );
      if (attempt < MAX_RETRIES) {
        await sleep(RETRY_DELAY_MS);
      }
    }
  }

  throw new Error(
    `stepNextBar failed after ${MAX_RETRIES} attempts: ${String(lastError)}`
  );
}
