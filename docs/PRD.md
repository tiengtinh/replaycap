# Product Requirements Document

## Product

TradingView Replay Auto-Capture Script

## Version

Phase 1 / V1

## Goal

Build a local script that automates TradingView Bar Replay for a manually selected replay start point, advances one bar at a time, waits until the newly drawn bar is fully painted, captures a full-page screenshot, and saves screenshots locally until the replay reaches the next calendar day.

This is for personal use only.

---

## Locked Decisions

* **Platform:** Browser automation only
* **Runtime OS first:** macOS
* **Future OS:** Linux
* **TradingView client:** Web browser, not desktop app
* **App type:** Script runnable with `npm start`
* **Phase scope:** Phase 1 only
* **Capture style:** Full-page screenshot
* **Cropping:** None for V1
* **Replay setup:** User manually sets replay start point in TradingView
* **Navigation style:** Script presses **Next bar** each time
* **Stop condition:** Date changes beyond target day
* **Market/layout for V1:** `VN301!`, dual layout, `1m` on the left and `5m` on the right
* **Expected run size:** ~241 bars
* **Capture contents:** Everything visible on screen
* **Output folder naming:** `YYYY-MM-DD-tv-bt`
* **Filename style:** Include symbol, timeframe/layout context if possible, target day, bar index, and bar datetime

---

## Problem Statement

The user wants to use TradingView Bar Replay normally and manually choose the replay starting point. After that, the script should take over and do the following loop:

1. Advance to the next bar.
2. Wait until the chart is fully updated.
3. Read the currently displayed date from the chart UI.
4. Save a screenshot.
5. Repeat until the replay advances into the next date.

The system must be reliable enough that screenshots are taken **after the bar is fully painted**, not during partial rendering.

---

## Primary User Flow

### Manual steps by user

1. Open TradingView in browser using existing account.
2. Open the target chart layout.
3. Configure the dual layout:

   * left chart: `VN301!` 1m
   * right chart: `VN301!` 5m
4. Open Bar Replay.
5. Manually select the replay start point for the target trading day.
6. Ensure the chart is in the intended visual state.
7. Run the local script.

### Automated steps by script

1. Connect to the browser session.
2. Wait for user confirmation / start command.
3. Read the current target date from the chart UI.
4. Loop:

   * click or trigger **Next bar**
   * detect that screen changed
   * wait until rendering stabilizes
   * read on-chart current date
   * if date is still target date, capture screenshot and save
   * if date has moved to next day, stop without capturing that next-day frame
5. Write run summary to disk.

---

## Success Criteria

V1 is successful if:

1. The script can complete one replay run for a single trading day without manual intervention after start.
2. Each screenshot is captured only after the new bar is fully rendered.
3. The script stops when the replay date moves past the target day.
4. Screenshots are saved in order with deterministic file names.
5. The script runs locally with `npm start`.
6. The implementation is easy for AI to run, test, and iterate on.

---

## Non-Goals for V1

The following are explicitly out of scope:

* Full automatic TradingView login flow
* Automatic calendar/day selection in replay UI
* Cropped clean chart export
* TradingView built-in snapshot automation
* OCR-based date reading
* Cloud deployment
* Multi-account scaling
* Parallel replay sessions
* Production GUI / desktop app
* Automatic indicator/state setup
* Automatic recovery from login expiration

---

## Core Functional Requirements

### FR1 — Launch and attach

The script must launch or attach to a Chromium browser session with a persistent profile so the user can stay logged into TradingView.

### FR2 — Manual replay setup

The script must assume the user already selected the replay start point manually.

### FR3 — Start control

The script must provide a simple start flow, either:

* press Enter in terminal after setup, or
* start immediately after script opens and detects TradingView page

For V1, terminal confirmation is preferred.

### FR4 — Next-bar stepping

The script must advance replay one bar at a time using TradingView’s **Next bar** control.

### FR5 — Render completion detection

After each step, the script must wait for the bar to be fully painted before capture.

This must not rely on a single fixed sleep alone.

### FR6 — Date reading

The script must read the currently displayed date from the chart UI.

Current assumption for V1:

* there is a visible blue rectangle at the bottom-right of the chart showing the current date, e.g. `2026-03-13`
* the script may use this as the primary source for current replay date

### FR7 — End-of-day logic

The script must stop when the date displayed on chart becomes later than the target date.

Important:

* replay may continue into the next day
* therefore stop condition must be based on **reading the date**, not just end-of-replay UI state

### FR8 — Screenshot capture

The script must capture a **full-page screenshot** after each confirmed fully painted bar.

### FR9 — File output

The script must save screenshots to a local folder named like:

`2026-03-13-tv-bt`

### FR10 — File naming

The script must use deterministic file names. Target pattern:

`VN301!__dual__2026-03-13__bar_0001__2026-03-13_09-31-00.png`

If exact time cannot be read in V1, fallback pattern:

`VN301!__dual__2026-03-13__bar_0001.png`

### FR11 — Run summary

At end of run, the script must save a JSON summary including:

* target date
* symbol
* layout mode
* bars captured
* start time
* end time
* output directory
* any retries/errors

---

## Key Technical Assumptions

1. TradingView replay can be advanced one step at a time through a clickable UI control or equivalent keyboard shortcut.
2. The visible chart is drawn on canvas.
3. One of the chart canvases is:

```html
<canvas data-qa-id="pane-top-canvas" aria-label="Chart for HNX_DLY:VN301!, 5 minutes"></canvas>
```

4. The visible current date can be read from a stable chart UI element near the bottom-right corner.
5. Full-page screenshots are acceptable in V1 even if browser UI and TradingView chrome are visible.

---

## Reliability Strategy

### Why reliability is hard

The challenge is not screenshot saving. The challenge is ensuring the bar is fully rendered before capture.

TradingView charts are canvas-based and may visually update in stages.

### V1 render-settle strategy

Use a multi-step settle check:

1. Trigger next bar.
2. Wait for a visible page/chart change.
3. Poll small screenshots repeatedly.
4. Compare consecutive image hashes.
5. When image is unchanged for N consecutive polls, treat frame as stable.
6. Then read current date and capture final screenshot.

### V1 recommendation

* poll interval: 150–250 ms
* stable frame threshold: 2–3 consecutive identical checks
* fallback timeout per bar: configurable

---

## Date Detection Strategy

### Primary strategy

Read the visible date badge / rectangle in the bottom-right chart area.

### Secondary strategy

If needed later, add calibrated region extraction for date text.

### Out of scope for V1

OCR should be avoided unless absolutely necessary.

---

## State Machine

The automation must be implemented as an explicit state machine.

### States

* `IDLE`
* `WAITING_FOR_USER_READY`
* `READING_TARGET_DATE`
* `ADVANCING_BAR`
* `WAITING_FOR_VISUAL_CHANGE`
* `WAITING_FOR_STABLE_FRAME`
* `READING_CURRENT_DATE`
* `CAPTURING_SCREENSHOT`
* `SAVING_OUTPUT`
* `CHECKING_STOP_CONDITION`
* `DONE`
* `ERROR`

This is required to avoid async control-flow becoming brittle.

---

## Tech Stack

### Required runtime

* Node.js 22+
* TypeScript
* Playwright

### Required libraries

* `playwright`
* `sharp`
* `zod`
* `pino`
* `fs-extra`
* `commander`
* `tsx`

### Suggested package manager

* `pnpm` preferred
* `npm` acceptable

---

## Tooling Required So AI Can Auto-Run and Test

This is mandatory for the next stage.

### Install requirements

```bash
pnpm add -D playwright typescript tsx @types/node
pnpm add sharp zod pino fs-extra commander
pnpm exec playwright install chromium
```

### Required repo scripts

```json
{
  "scripts": {
    "start": "tsx src/index.ts",
    "dev": "tsx watch src/index.ts",
    "test:e2e": "playwright test",
    "codegen": "playwright codegen",
    "trace": "playwright show-trace"
  }
}
```

### Required AI-friendly capabilities

1. **Headed browser mode** so the browser is visible during automation.
2. **Persistent browser profile** so TradingView login survives restarts.
3. **Playwright codegen** so selectors can be recorded and updated quickly.
4. **Playwright trace viewer** so failed runs can be debugged visually.
5. **Config file support** so AI can modify behavior without rewriting logic.
6. **Dry-run mode** so AI can test button finding, date reading, and screenshot saving without doing a full trading-day replay.

---

## Project Structure

```text
tradingview-bt/
  package.json
  tsconfig.json
  prod.md
  src/
    index.ts
    config.ts
    types.ts
    stateMachine.ts
    browser/
      launchBrowser.ts
      attachTradingViewPage.ts
    tradingview/
      findReplayControls.ts
      stepNextBar.ts
      readCurrentDate.ts
      findChartCanvas.ts
    capture/
      waitForVisualChange.ts
      waitForStableFrame.ts
      saveScreenshot.ts
      hashImage.ts
    run/
      runReplayCapture.ts
      writeRunSummary.ts
    utils/
      sleep.ts
      logger.ts
      formatFileName.ts
  output/
    2026-03-13-tv-bt/
```

---

## Proposed Config Shape

```ts
export type AppConfig = {
  browser: {
    headless: false;
    userDataDir: string;
    viewport: {
      width: number;
      height: number;
    };
  };
  tradingView: {
    url: string;
    expectedSymbol: string;
    layoutMode: 'dual';
  };
  run: {
    outputRoot: string;
    targetDate?: string;
    maxBars: number;
    waitForUserReady: boolean;
  };
  settle: {
    pollMs: number;
    stableFrames: number;
    firstChangeTimeoutMs: number;
    stableTimeoutMs: number;
  };
};
```

---

## Command-Line UX

### V1 command

```bash
npm start
```

### Expected terminal flow

1. Script opens browser or attaches to TradingView page.
2. Script prints:

   * confirm browser found
   * confirm replay controls found
   * prompt user to manually prepare replay start point
3. User presses Enter.
4. Script reads current date.
5. Script starts stepping and saving.
6. Script prints progress like:

   * current bar index
   * current date read
   * output file path
7. Script exits with summary.

---

## Detailed Run Logic

### Step 0 — Startup

* launch Playwright Chromium in headed mode
* use persistent profile directory
* open TradingView page if not already open

### Step 1 — Preconditions

* locate TradingView page/tab
* detect replay controls
* verify page is loaded enough to operate

### Step 2 — User-ready gate

* prompt user to manually set replay start point
* user presses Enter to continue

### Step 3 — Determine target date

* read current date from chart UI
* store as `targetDate`
* create output folder `${targetDate}-tv-bt`

### Step 4 — Loop

For each bar:

1. trigger next bar
2. wait for visual change
3. wait for stable frame
4. read current date from chart
5. if current date > targetDate:

   * stop immediately
   * do not capture this frame
6. otherwise:

   * take full-page screenshot
   * save deterministic filename
   * increment bar index
7. if bar index exceeds safety max, stop with warning

### Step 5 — Finish

* save run summary JSON
* print summary to console

---

## Error Handling Requirements

### Retryable cases

* next-bar click fails once
* visible change takes too long
* one screenshot save fails
* temporary overlay appears

### Non-retryable cases

* TradingView page not found
* replay controls cannot be found
* target date cannot be read at start
* repeated failures over configured threshold

### Logging

Use structured logs for each major step.

Minimum fields:

* state
* barIndex
* targetDate
* currentDate
* filePath
* elapsedMs
* error

---

## Selectors and Detection Strategy

### Known chart clue

User provided a canvas like:

```html
<canvas data-qa-id="pane-top-canvas" aria-label="Chart for HNX_DLY:VN301!, 5 minutes"></canvas>
```

This should be used as a strong anchor for chart presence detection.

### Selector strategy order

1. Use stable `data-qa-*` attributes where possible.
2. Use accessible labels / button text where possible.
3. Keep selectors centralized in one file.
4. Add fallback selectors for replay controls.

### Important note

Do not spread TradingView selectors across many files.
Keep them in a dedicated selector map so future fixes are cheap.

---

## Performance Expectations

### V1 speed target

Per-bar processing should be as fast as possible while still reliable.

Expected rough sequence per bar:

* replay step: very fast
* first visual change: fast
* stable-frame wait: short
* screenshot save: moderate

Given ~241 bars, overall runtime should stay practical for one trading day.

### Optimization priority

Priority order:

1. correctness
2. deterministic date stop
3. speed

---

## Testing Requirements

### Manual test scenarios

1. **Happy path**

   * replay starts on correct day
   * script captures all bars for that day
   * stops at next day

2. **Date boundary case**

   * replay crosses midnight/session boundary
   * script stops correctly

3. **Replay control failure**

   * one next-bar action fails
   * retry works

4. **Slow render case**

   * visual settling takes longer
   * script still captures after stabilization

5. **Safety limit case**

   * date never changes or cannot be read later
   * script stops at `maxBars`

### AI-testable modules

Unit-testable logic should be isolated for:

* filename formatting
* date comparison
* config validation
* state transitions
* run summary formatting

### Browser-level automated tests

Use Playwright tests for:

* browser startup
* screenshot save
* dummy page visual-stability detector

TradingView live replay itself may remain semi-manual for first-stage validation.

---

## Required Output Artifacts

For each run:

### Folder

`output/2026-03-13-tv-bt/`

### Files

* screenshots
* `run-summary.json`
* optional log file later

### Example

```text
output/
  2026-03-13-tv-bt/
    VN301!__dual__2026-03-13__bar_0001__2026-03-13_09-31-00.png
    VN301!__dual__2026-03-13__bar_0002__2026-03-13_09-32-00.png
    run-summary.json
```

---

## V1 Implementation Order

1. bootstrap Node + TypeScript + Playwright project
2. add persistent browser launch
3. detect TradingView page and chart canvas
4. detect replay next-bar control
5. implement simple manual start flow
6. implement visual change + stable-frame detection
7. implement date reading from chart UI
8. implement date-based stop logic
9. implement full-page screenshot saving
10. implement run summary
11. add dry-run mode
12. add basic Playwright tests and trace support

---

## Risks

### Product/Platform risks

* TradingView UI may change selectors
* overlays/popups may interrupt automation
* account/session may expire
* automated use may trigger platform restrictions

### Technical risks

* date badge may not be easily readable by DOM selector
* canvas redraw may require careful settle tuning
* dual layout may cause multiple similar canvases and controls

### Mitigations

* keep Phase 1 manual-start
* use persistent profile
* centralize selectors
* add dry-run calibration mode
* add safety max bars
* build around one exact user workflow first

---

## Explicit V1 Scope Summary

Build a local Playwright + TypeScript script for macOS that:

* assumes the user has already logged into TradingView
* assumes the user has already manually set replay start point
* reads the visible current chart date
* presses next bar repeatedly
* waits for the chart to finish painting
* saves a full-page screenshot after each bar
* stores files in a folder like `2026-03-13-tv-bt`
* stops when the replay date advances beyond the target date
* runs from `npm start`

---

## Future Enhancements After V1

Not for now, but likely next:

* crop to chart or selected region
* support TradingView built-in snapshot mode
* add automatic replay-day selection
* add hotkey controls for pause/resume
* add resume-from-last-bar
* add Linux packaging
* add OCR fallback for date reading
* add mini local GUI
* support multiple layouts / symbols

---

## Build Acceptance Checklist

The build is accepted when all are true:

* [ ] `npm start` launches the script locally
* [ ] TradingView page is detected
* [ ] user can manually prepare replay then press Enter
* [ ] script captures bar-by-bar screenshots
* [ ] screenshots are taken after frame stabilization
* [ ] output folder uses `${targetDate}-tv-bt`
* [ ] filenames are deterministic and ordered
* [ ] script stops when chart date exceeds target date
* [ ] run summary JSON is written
* [ ] codebase includes tools needed for AI auto-run and testing
