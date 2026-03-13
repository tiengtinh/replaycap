import type { Page } from "playwright";
import { SELECTORS } from "./selectors.js";
import { logger } from "../utils/logger.js";

// Matches YYYY-MM-DD
const DATE_PATTERN = /\d{4}-\d{2}-\d{2}/;
// Matches HH:MM or HH:MM:SS
const TIME_PATTERN = /\d{2}:\d{2}(?::\d{2})?/;

export type DateTimeReading = {
  date: string;
  time: string | null;
};

/**
 * Reads the current replay date from the TradingView chart UI.
 *
 * Strategy:
 *  1. Try known date badge selectors from the selector map.
 *  2. If none found, scan all visible elements for text matching YYYY-MM-DD.
 *
 * Returns null if no date can be read — the caller must handle this as a stop condition.
 */
export async function readCurrentDate(
  page: Page
): Promise<DateTimeReading | null> {
  // --- Strategy 1: known selectors ---
  for (const selector of SELECTORS.dateBadge) {
    try {
      const el = await page.$(selector);
      if (!el) continue;
      const visible = await el.isVisible();
      if (!visible) continue;
      const text = (await el.textContent()) ?? "";
      const dateMatch = DATE_PATTERN.exec(text);
      if (dateMatch) {
        const timeMatch = TIME_PATTERN.exec(text);
        logger.info(
          { selector, text, date: dateMatch[0] },
          "Date read from badge selector"
        );
        return { date: dateMatch[0], time: timeMatch ? timeMatch[0] : null };
      }
    } catch {
      // Selector failed — try next
    }
  }

  // --- Strategy 2: scan page for date text ---
  try {
    const dateText = await page.evaluate((pattern: string) => {
      const re = new RegExp(pattern);
      // Walk all text nodes
      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT
      );
      let node: Node | null;
      while ((node = walker.nextNode())) {
        const text = node.textContent ?? "";
        if (re.test(text)) {
          return text.trim();
        }
      }
      return null;
    }, DATE_PATTERN.source);

    if (dateText) {
      const dateMatch = DATE_PATTERN.exec(dateText);
      const timeMatch = TIME_PATTERN.exec(dateText);
      if (dateMatch) {
        logger.info(
          { dateText, date: dateMatch[0] },
          "Date read via page text scan"
        );
        return { date: dateMatch[0], time: timeMatch ? timeMatch[0] : null };
      }
    }
  } catch (err) {
    logger.warn({ error: String(err) }, "Page text scan for date failed");
  }

  logger.warn("Could not read current date from chart UI");
  return null;
}
