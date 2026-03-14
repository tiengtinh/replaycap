import type { Page, ElementHandle } from "playwright";
import path from "path";
import readline from "readline";
import type { AppConfig, RunState, RunSummary } from "../types.js";
import { State } from "../types.js";
import { findChartCanvas } from "../tradingview/findChartCanvas.js";
import { findNextBarButton, isReplayActive } from "../tradingview/findReplayControls.js";
import { stepNextBar } from "../tradingview/stepNextBar.js";
import { captureDateRegion } from "../tradingview/readCurrentDate.js";
import { hashImage } from "../capture/hashImage.js";
import { waitForVisualChange } from "../capture/waitForVisualChange.js";
import { waitForStableFrame } from "../capture/waitForStableFrame.js";
import { saveScreenshot } from "../capture/saveScreenshot.js";
import { writeRunSummary } from "./writeRunSummary.js";
import { formatFileName } from "../utils/formatFileName.js";
import { logStep, logError, logWarn } from "../utils/logger.js";

async function promptLine(message: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise<string>((resolve) => {
    rl.question(message, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function promptEnter(message: string): Promise<void> {
  await promptLine(message);
}

/**
 * Main state machine that drives the entire replay capture loop.
 *
 * Date detection strategy:
 *   The TradingView date badge is canvas-rendered and cannot be read from the DOM.
 *   Instead we:
 *     1. Ask the user for the target date at startup (or accept --target-date CLI flag).
 *     2. Capture a screenshot crop of the bottom-right canvas corner (the date badge region).
 *     3. Hash that region before and after each bar advance.
 *     4. When the hash changes, the date has rolled over — stop.
 */
export async function runReplayCapture(
  page: Page,
  config: AppConfig,
  opts: { dryRun?: boolean } = {}
): Promise<RunSummary> {
  const { dryRun = false } = opts;
  let currentState: State = State.IDLE;

  const runState: RunState = {
    targetDate: config.run.targetDate ?? "",
    outputDir: "",
    barIndex: 0,
    startTime: new Date(),
    bars: [],
    errors: [],
  };

  const transition = (next: State) => {
    logStep({ state: next }, `→ ${next}`);
    currentState = next;
  };

  try {
    // ── WAITING_FOR_USER_READY ────────────────────────────────────────────────
    transition(State.WAITING_FOR_USER_READY);

    console.log("\n=== TradingView Bar Replay Capture ===");
    console.log("\n  The browser is open. Please:");
    console.log("    1. Open TradingView and load the VN301! dual layout (1m left, 5m right)");
    console.log("    2. Enable Bar Replay and position the replay start point");
    console.log("    3. Make sure the chart is fully loaded and the replay toolbar is visible");

    if (config.run.waitForUserReady) {
      await promptEnter("\n→ When ready, press Enter to continue...\n");
    }

    // Verify chart canvas
    const canvas: ElementHandle<Element> = await findChartCanvas(page);
    console.log("✓ Chart canvas detected");

    // Verify replay toolbar
    const replayActive = await isReplayActive(page);
    if (!replayActive) {
      logWarn({}, "Replay toolbar not detected");
      console.warn("⚠  Replay toolbar not detected. Make sure Bar Replay mode is on.");
    } else {
      console.log("✓ Replay toolbar detected");
    }

    // Verify next bar button
    await findNextBarButton(page);
    console.log("✓ Next Bar button found");

    // ── READING_TARGET_DATE ───────────────────────────────────────────────────
    transition(State.READING_TARGET_DATE);

    // Target date: use CLI flag if provided, otherwise ask the user.
    let targetDate = config.run.targetDate ?? "";
    if (!targetDate) {
      targetDate = await promptLine(
        "\n  Enter the target date to capture (YYYY-MM-DD): "
      );
      if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
        throw new Error(`Invalid date format: "${targetDate}". Expected YYYY-MM-DD.`);
      }
    }

    runState.targetDate = targetDate;
    runState.outputDir = path.join(config.run.outputRoot, `${targetDate}-tv-bt`);

    // Capture baseline date-region hash — used to detect when the date rolls over.
    const baselineDateRegion = await captureDateRegion(page, canvas);
    const baselineDateHash = hashImage(baselineDateRegion);

    console.log(`\n  Target date        : ${targetDate}`);
    console.log(`  Output dir         : ${runState.outputDir}`);
    console.log(`  Max bars           : ${config.run.maxBars}`);
    console.log(`  Date region hash   : ${baselineDateHash.slice(0, 12)}…`);
    if (dryRun) console.log("  Mode               : DRY RUN (1 bar only)\n");
    else console.log();

    // ── DRY RUN ───────────────────────────────────────────────────────────────
    if (dryRun) {
      const fileName = formatFileName({
        symbol: config.tradingView.expectedSymbol,
        layoutMode: config.tradingView.layoutMode,
        targetDate,
        barIndex: 0,
      });
      const filePath = path.join(runState.outputDir, fileName);
      await saveScreenshot(page, filePath);
      console.log(`  Dry-run screenshot saved: ${filePath}`);

      const summary: RunSummary = {
        targetDate,
        symbol: config.tradingView.expectedSymbol,
        layoutMode: config.tradingView.layoutMode,
        barsCaptured: 0,
        startTime: runState.startTime.toISOString(),
        endTime: new Date().toISOString(),
        outputDirectory: runState.outputDir,
        bars: [],
        errors: [],
      };
      await writeRunSummary(summary);
      return summary;
    }

    // ── MAIN LOOP ─────────────────────────────────────────────────────────────
    while (runState.barIndex < config.run.maxBars) {
      const barStart = Date.now();

      // Snapshot full-page baseline for visual-change detection
      const baselineBuf = await page.screenshot({ fullPage: false });
      const baselineHash = hashImage(baselineBuf);

      // ADVANCING_BAR
      transition(State.ADVANCING_BAR);
      await stepNextBar(page, runState.barIndex);

      // WAITING_FOR_VISUAL_CHANGE
      transition(State.WAITING_FOR_VISUAL_CHANGE);
      await waitForVisualChange(page, {
        baselineHash,
        pollMs: config.settle.pollMs,
        timeoutMs: config.settle.firstChangeTimeoutMs,
        barIndex: runState.barIndex,
      });

      // WAITING_FOR_STABLE_FRAME
      transition(State.WAITING_FOR_STABLE_FRAME);
      await waitForStableFrame(page, {
        pollMs: config.settle.pollMs,
        stableFrames: config.settle.stableFrames,
        timeoutMs: config.settle.stableTimeoutMs,
        barIndex: runState.barIndex,
      });

      // READING_CURRENT_DATE — compare date-region hash to baseline
      transition(State.READING_CURRENT_DATE);
      const currentDateRegion = await captureDateRegion(page, canvas);
      const currentDateHash = hashImage(currentDateRegion);
      const dateChanged = currentDateHash !== baselineDateHash;

      logStep(
        {
          barIndex: runState.barIndex,
          targetDate,
          dateChanged,
          dateHash: currentDateHash.slice(0, 12),
        },
        "Date region check"
      );

      // CHECKING_STOP_CONDITION
      transition(State.CHECKING_STOP_CONDITION);

      if (dateChanged) {
        logStep(
          { barIndex: runState.barIndex, targetDate },
          "Date region changed — replay crossed into next day, stopping"
        );
        break;
      }

      // CAPTURING_SCREENSHOT
      transition(State.CAPTURING_SCREENSHOT);
      runState.barIndex++;

      const fileName = formatFileName({
        symbol: config.tradingView.expectedSymbol,
        layoutMode: config.tradingView.layoutMode,
        targetDate,
        barIndex: runState.barIndex,
      });
      const filePath = path.join(runState.outputDir, fileName);

      // SAVING_OUTPUT
      transition(State.SAVING_OUTPUT);
      await saveScreenshot(page, filePath);

      const elapsed = Date.now() - barStart;
      runState.bars.push({
        barIndex: runState.barIndex,
        date: targetDate,
        time: null,
        filePath,
        elapsedMs: elapsed,
      });

      console.log(
        `  bar ${String(runState.barIndex).padStart(4, "0")}  ${targetDate}  ${path.basename(filePath)}  (${elapsed}ms)`
      );
    }

    if (runState.barIndex >= config.run.maxBars) {
      logWarn({ maxBars: config.run.maxBars }, "Safety max bars reached — stopping");
      runState.errors.push(`Safety limit: maxBars=${config.run.maxBars} reached`);
    }

    // ── DONE ─────────────────────────────────────────────────────────────────
    transition(State.DONE);

    const summary: RunSummary = {
      targetDate,
      symbol: config.tradingView.expectedSymbol,
      layoutMode: config.tradingView.layoutMode,
      barsCaptured: runState.barIndex,
      startTime: runState.startTime.toISOString(),
      endTime: new Date().toISOString(),
      outputDirectory: runState.outputDir,
      bars: runState.bars,
      errors: runState.errors,
    };

    await writeRunSummary(summary);

    console.log(`\n=== Run complete ===`);
    console.log(`  Bars captured : ${summary.barsCaptured}`);
    console.log(`  Output        : ${summary.outputDirectory}`);

    return summary;
  } catch (err) {
    transition(State.ERROR);
    const message = err instanceof Error ? err.message : String(err);
    logError({ state: currentState, error: message }, "Fatal error in replay capture");
    runState.errors.push(message);

    const summary: RunSummary = {
      targetDate: runState.targetDate,
      symbol: config.tradingView.expectedSymbol,
      layoutMode: config.tradingView.layoutMode,
      barsCaptured: runState.barIndex,
      startTime: runState.startTime.toISOString(),
      endTime: new Date().toISOString(),
      outputDirectory: runState.outputDir || config.run.outputRoot,
      bars: runState.bars,
      errors: runState.errors,
    };

    if (runState.outputDir) {
      try {
        await writeRunSummary(summary);
      } catch {
        // best-effort
      }
    }

    throw err;
  }
}
