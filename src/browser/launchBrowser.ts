import { chromium, type BrowserContext } from "playwright";
import fsExtra from "fs-extra";
import path from "path";
import type { AppConfig } from "../types.js";
import { logger } from "../utils/logger.js";

const { pathExists, readJson, writeJson } = fsExtra;

// Strips any stored per-host page zoom from Chromium's Preferences file so
// every launch starts at 100% zoom. Without this, a one-time accidental zoom
// (e.g. Ctrl+- on TradingView) is persisted in the profile and inflates the
// logical viewport that page.screenshot() captures, producing oversized PNGs
// with gray padding around the chart UI. page.keyboard.press("Control+0") does
// NOT work — Ctrl+0 is handled by Chromium's browser process, but Playwright
// dispatches keyboard events to the renderer, so the shortcut never fires.
async function clearPersistedZoom(userDataDir: string): Promise<void> {
  const prefsPath = path.join(userDataDir, "Default", "Preferences");
  if (!(await pathExists(prefsPath))) return;

  let prefs: Record<string, unknown>;
  try {
    prefs = await readJson(prefsPath);
  } catch (err) {
    logger.warn({ prefsPath, error: String(err) }, "Could not parse Chromium Preferences — skipping zoom reset");
    return;
  }

  const partition = prefs.partition as { per_host_zoom_levels?: unknown } | undefined;
  if (partition?.per_host_zoom_levels) {
    delete partition.per_host_zoom_levels;
    await writeJson(prefsPath, prefs);
    logger.info({ prefsPath }, "Cleared persisted per-host zoom levels");
  }
}

/**
 * Launches Chromium in headed mode with a persistent user profile.
 * The persistent profile keeps TradingView logged in across runs.
 */
export async function launchBrowser(config: AppConfig): Promise<BrowserContext> {
  const { userDataDir, viewport } = config.browser;

  await clearPersistedZoom(userDataDir);

  logger.info({ userDataDir }, "Launching Chromium with persistent profile");

  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    viewport: null,   // let the OS window size determine the viewport
    args: [
      `--window-size=${viewport.width},${viewport.height}`,
      "--disable-blink-features=AutomationControlled",
      "--no-first-run",
      "--no-default-browser-check",
    ],
  });

  logger.info("Browser launched");
  return context;
}
