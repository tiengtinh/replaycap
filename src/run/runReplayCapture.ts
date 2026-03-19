import type { Page, ElementHandle } from "playwright";
import path from "path";
import readline from "readline";
import type { AppConfig, RunState, RunSummary } from "../types.js";
import { State } from "../types.js";
import { findChartCanvas } from "../tradingview/findChartCanvas.js";
import { findNextBarButton, isReplayActive } from "../tradingview/findReplayControls.js";
import { stepNextBar } from "../tradingview/stepNextBar.js";
import { readCurrentDate, terminateOcrWorker } from "../tradingview/readCurrentDate.js";
import { hashImage } from "../capture/hashImage.js";
import { waitForVisualChange } from "../capture/waitForVisualChange.js";
import { waitForStableFrame } from "../capture/waitForStableFrame.js";
import { saveScreenshot } from "../capture/saveScreenshot.js";
import { writeRunSummary } from "./writeRunSummary.js";
import { formatFileName } from "../utils/formatFileName.js";
import { logStep, logError, logWarn } from "../utils/logger.js";
import { sleep } from "../utils/sleep.js";

const OCR_MAX_RETRIES = 3;
const OCR_RETRY_DELAY_MS = 750;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

async function promptLine(message: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
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

async function promptTargetDate(): Promise<string> {
  while (true) {
    const answer = await promptLine("→ Enter target date (YYYY-MM-DD): ");
    if (DATE_PATTERN.test(answer)) {
      return answer;
    }
    console.warn("  Invalid date format. Expected YYYY-MM-DD.");
  }
}

function createManualStopController(enabled: boolean) {
  let stopRequested = false;
  let rl: readline.Interface | null = null;

  const handleLine = () => {
    stopRequested = true;
  };

  if (enabled) {
    rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.on("line", handleLine);
  }

  return {
    isStopRequested: () => stopRequested,
    close: () => {
      if (!rl) return;
      rl.off("line", handleLine);
      rl.close();
      rl = null;
    },
  };
}

async function readCurrentDateWithRetries(
  page: Page,
  canvas: ElementHandle<Element>,
  opts: {
    debugDir?: string;
    barIndex?: number;
    phase: "targetDate" | "barDate";
  }
) {
  let reading: Awaited<ReturnType<typeof readCurrentDate>> | null = null;

  for (let attempt = 1; attempt <= OCR_MAX_RETRIES; attempt++) {
    reading = await readCurrentDate(page, canvas, opts.debugDir);
    if (reading) {
      if (attempt > 1) {
        logStep(
          { barIndex: opts.barIndex, attempt, phase: opts.phase, currentDate: reading.date },
          "OCR succeeded after retry"
        );
      }
      return reading;
    }

    if (attempt < OCR_MAX_RETRIES) {
      logWarn(
        { barIndex: opts.barIndex, attempt, phase: opts.phase },
        "OCR returned no date — retrying"
      );
      await sleep(OCR_RETRY_DELAY_MS);
    }
  }

  return null;
}

export async function runReplayCapture(
  page: Page,
  config: AppConfig,
  opts: { dryRun?: boolean } = {}
): Promise<RunSummary> {
  const { dryRun = false } = opts;
  let currentState: State = State.IDLE;
  const manualStopController = createManualStopController(
    !dryRun && config.run.stopMode === "manual"
  );

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
    console.log("    1. Load the VN301! dual layout (1m left, 5m right)");
    console.log("    2. Enable Bar Replay and position the replay start point");
    console.log("    3. Make sure the chart is fully loaded and the replay toolbar is visible");

    if (config.run.waitForUserReady) {
      await promptEnter("\n→ When ready, press Enter to continue...\n");
    }

    const canvas: ElementHandle<Element> = await findChartCanvas(page);
    console.log("✓ Chart canvas detected");

    const replayActive = await isReplayActive(page);
    if (!replayActive) {
      logWarn({}, "Replay toolbar not detected");
      console.warn("⚠  Replay toolbar not detected. Make sure Bar Replay mode is on.");
    } else {
      console.log("✓ Replay toolbar detected");
    }

    await findNextBarButton(page);
    console.log("✓ Next Bar button found");

    // ── READING_TARGET_DATE ───────────────────────────────────────────────────
    transition(State.READING_TARGET_DATE);

    let targetDate = config.run.targetDate ?? "";

    if (!targetDate) {
      console.log("\n  Reading date from chart via OCR...");
      const reading = await readCurrentDateWithRetries(page, canvas, {
        phase: "targetDate",
      });
      if (!reading) {
        if (config.run.stopMode === "manual") {
          logWarn({}, "Startup OCR failed in manual mode — prompting for target date");
          console.warn("  OCR failed at startup.");
          targetDate = await promptTargetDate();
        } else {
          throw new Error(
            "OCR could not read the date from the chart.\n" +
            "  • Check tmp/canvas-latest.png to verify the canvas is captured correctly.\n" +
            "  • Or pass --target-date YYYY-MM-DD to skip OCR."
          );
        }
      } else {
        targetDate = reading.date;
        console.log(`  OCR detected date: ${targetDate}`);
      }
    }

    runState.targetDate = targetDate;
    runState.outputDir = path.join(config.run.outputRoot, `${targetDate}-tv-bt`);

    const debugDir = dryRun ? runState.outputDir : undefined;

    console.log(`\n  Target date : ${targetDate}`);
    console.log(`  Output dir  : ${runState.outputDir}`);
    console.log(`  Max bars    : ${config.run.maxBars}`);
    console.log(
      `  Stop mode   : ${config.run.stopMode === "manual"
        ? "manual (press Enter again to stop after the current bar)"
        : "date (OCR after each bar)"}`
    );
    if (dryRun) {
      console.log("  Mode        : DRY RUN");
      console.log("  Debug imgs  : debug-strip.png, debug-badge.png saved to output dir\n");
    } else {
      console.log();
    }

    // ── DRY RUN ───────────────────────────────────────────────────────────────
    if (dryRun) {
      // Save full screenshot
      const fileName = formatFileName({
        symbol: config.tradingView.expectedSymbol,
        layoutMode: config.tradingView.layoutMode,
        targetDate,
        barIndex: 0,
      });
      const filePath = path.join(runState.outputDir, fileName);
      await saveScreenshot(page, filePath);
      console.log(`  Full screenshot : ${filePath}`);

      // Also run OCR with debug images saved
      console.log("  Running OCR on date badge...");
      const reading = await readCurrentDateWithRetries(page, canvas, {
        debugDir,
        phase: "barDate",
      });
      if (reading) {
        console.log(`  OCR result  : date=${reading.date}  time=${reading.time ?? "(none)"}`);
      } else {
        console.warn("  OCR result  : no date found — check debug-strip.png and debug-badge.png");
      }

      const summary: RunSummary = {
        targetDate,
        symbol: config.tradingView.expectedSymbol,
        layoutMode: config.tradingView.layoutMode,
        stopMode: config.run.stopMode,
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
      if (manualStopController.isStopRequested()) {
        logStep({ barIndex: runState.barIndex }, "Manual stop requested — stopping");
        break;
      }

      const barStart = Date.now();

      // Full-page baseline hash for visual-change detection
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

      let reading: Awaited<ReturnType<typeof readCurrentDateWithRetries>> | null = null;
      let currentDate: string | null = null;

      if (config.run.stopMode === "date") {
        // READING_CURRENT_DATE via OCR
        transition(State.READING_CURRENT_DATE);
        reading = await readCurrentDateWithRetries(page, canvas, {
          barIndex: runState.barIndex,
          phase: "barDate",
        });
        currentDate = reading?.date ?? null;

        logStep(
          { barIndex: runState.barIndex, targetDate, currentDate },
          "Date read after bar advance"
        );

        // CHECKING_STOP_CONDITION
        transition(State.CHECKING_STOP_CONDITION);

        if (!currentDate) {
          logWarn({ barIndex: runState.barIndex }, "OCR returned no date — stopping for safety");
          runState.errors.push(`bar ${runState.barIndex}: date unreadable — stopped`);
          break;
        }

        if (currentDate > targetDate) {
          logStep(
            { barIndex: runState.barIndex, currentDate, targetDate },
            "Date advanced past target — stopping"
          );
          break;
        }
      }

      // CAPTURING_SCREENSHOT
      transition(State.CAPTURING_SCREENSHOT);
      runState.barIndex++;

      const fileName = formatFileName({
        symbol: config.tradingView.expectedSymbol,
        layoutMode: config.tradingView.layoutMode,
        targetDate,
        barIndex: runState.barIndex,
        barDate: reading?.date,
        barTime: reading?.time,
      });
      const filePath = path.join(runState.outputDir, fileName);

      // SAVING_OUTPUT
      transition(State.SAVING_OUTPUT);
      await saveScreenshot(page, filePath);

      const elapsed = Date.now() - barStart;
      runState.bars.push({
        barIndex: runState.barIndex,
        date: currentDate ?? targetDate,
        time: reading?.time ?? null,
        filePath,
        elapsedMs: elapsed,
      });

      const barLabel = currentDate
        ? `${currentDate}${reading?.time ? " " + reading.time : ""}`
        : "manual-stop";
      console.log(
        `  bar ${String(runState.barIndex).padStart(4, "0")}  ${barLabel}  ${path.basename(filePath)}  (${elapsed}ms)`
      );

      if (config.run.stopMode === "manual" && manualStopController.isStopRequested()) {
        transition(State.CHECKING_STOP_CONDITION);
        logStep({ barIndex: runState.barIndex }, "Manual stop requested — stopping");
        break;
      }
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
      stopMode: config.run.stopMode,
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
    logError({ state: currentState, error: message }, "Fatal error");
    runState.errors.push(message);

    const summary: RunSummary = {
      targetDate: runState.targetDate,
      symbol: config.tradingView.expectedSymbol,
      layoutMode: config.tradingView.layoutMode,
      stopMode: config.run.stopMode,
      barsCaptured: runState.barIndex,
      startTime: runState.startTime.toISOString(),
      endTime: new Date().toISOString(),
      outputDirectory: runState.outputDir || config.run.outputRoot,
      bars: runState.bars,
      errors: runState.errors,
    };

    if (runState.outputDir) {
      try { await writeRunSummary(summary); } catch { /* best-effort */ }
    }

    throw err;
  } finally {
    manualStopController.close();
    await terminateOcrWorker();
  }
}
