import { Command } from "commander";
import { launchBrowser } from "./browser/launchBrowser.js";
import { attachTradingViewPage } from "./browser/attachTradingViewPage.js";
import { runReplayCapture } from "./run/runReplayCapture.js";
import { loadConfig } from "./config.js";
import { logger } from "./utils/logger.js";

const program = new Command();

program
  .name("replaycap")
  .description("TradingView Bar Replay Auto-Capture Script")
  .option("--dry-run", "Connect and take one calibration screenshot, then exit")
  .option(
    "--target-date <YYYY-MM-DD>",
    "Override target date (default: read from chart)"
  )
  .option(
    "--user-data-dir <path>",
    "Chromium persistent profile directory",
    "./.browser-profile"
  )
  .option("--output-root <path>", "Root directory for output folders", "./output")
  .option(
    "--no-wait",
    "Skip the user-ready prompt and start immediately"
  )
  .option(
    "--stop-mode <manual|date>",
    "How to stop capture: manual or date-based OCR",
    "manual"
  )
  .parse(process.argv);

const opts = program.opts<{
  dryRun?: boolean;
  targetDate?: string;
  userDataDir: string;
  outputRoot: string;
  wait: boolean;
  stopMode: "manual" | "date";
}>();

const config = loadConfig({
  browser: {
    userDataDir: opts.userDataDir,
  },
  run: {
    outputRoot: opts.outputRoot,
    targetDate: opts.targetDate,
    waitForUserReady: opts.wait,
    stopMode: opts.stopMode,
  },
});

let browserContext: Awaited<ReturnType<typeof launchBrowser>> | null = null;

async function main() {
  browserContext = await launchBrowser(config);
  const page = await attachTradingViewPage(browserContext, config);

  await runReplayCapture(page, config, { dryRun: opts.dryRun ?? false });
}

main().catch((err) => {
  logger.error({ error: String(err) }, "Unhandled error");
  process.exitCode = 1;
}).finally(async () => {
  if (browserContext) {
    await browserContext.close().catch(() => {});
  }
});
