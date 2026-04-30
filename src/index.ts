import { Command } from "commander";
import { launchBrowser } from "./browser/launchBrowser.js";
import { attachTradingViewPage } from "./browser/attachTradingViewPage.js";
import { runReplayCapture } from "./run/runReplayCapture.js";
import { loadConfig } from "./config.js";
import { logger } from "./utils/logger.js";

const program = new Command();

function readNpmConfigString(name: string): string | undefined {
  const value = process.env[`npm_config_${name}`];
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}

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
    "How to stop capture: manual or date-based OCR"
  )
  .parse(process.argv);

const opts = program.opts<{
  dryRun?: boolean;
  targetDate?: string;
  userDataDir: string;
  outputRoot: string;
  wait: boolean;
  stopMode?: "manual" | "date";
}>();

const targetDate = opts.targetDate ?? readNpmConfigString("target_date");
const stopMode = opts.stopMode ?? readNpmConfigString("stop_mode") ?? "manual";

const config = loadConfig({
  browser: {
    userDataDir: opts.userDataDir,
  },
  run: {
    outputRoot: opts.outputRoot,
    targetDate,
    waitForUserReady: opts.wait,
    stopMode,
  },
});

let browserContext: Awaited<ReturnType<typeof launchBrowser>> | null = null;
let shuttingDown = false;

async function shutdown(exitCode: number) {
  if (shuttingDown) return;
  shuttingDown = true;
  if (browserContext) {
    await browserContext.close().catch(() => {});
    browserContext = null;
  }
  process.exit(exitCode);
}

process.on("SIGINT", () => {
  logger.info({}, "SIGINT received — shutting down");
  void shutdown(130);
});
process.on("SIGTERM", () => {
  logger.info({}, "SIGTERM received — shutting down");
  void shutdown(143);
});

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
