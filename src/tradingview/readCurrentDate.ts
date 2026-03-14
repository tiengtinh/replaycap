import type { Page, ElementHandle } from "playwright";
import { logger } from "../utils/logger.js";

export type DateTimeReading = {
  date: string;
  time: string | null;
};

/**
 * Captures a screenshot of the bottom-right region of a canvas element.
 * This is where TradingView renders the current replay date badge.
 *
 * Returns the raw PNG buffer — callers hash it to detect date changes.
 */
export async function captureDateRegion(
  page: Page,
  canvas: ElementHandle<Element>
): Promise<Buffer> {
  const bbox = await canvas.boundingBox();
  if (!bbox) throw new Error("Cannot get canvas bounding box for date region");

  // The date badge occupies the bottom-right corner of the chart canvas.
  // 220x30 px is wide enough to cover a full YYYY-MM-DD label.
  const regionWidth = 220;
  const regionHeight = 36;

  const buf = await page.screenshot({
    clip: {
      x: bbox.x + bbox.width - regionWidth,
      y: bbox.y + bbox.height - regionHeight,
      width: regionWidth,
      height: regionHeight,
    },
  });

  logger.debug({ clip: { regionWidth, regionHeight } }, "Date region captured");
  return buf as Buffer;
}
