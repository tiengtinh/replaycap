<!-- refreshed: 2026-04-29 -->
# Architecture

**Analysis Date:** 2026-04-29

## System Overview

```text
┌─────────────────────────────────────────────────────────────┐
│                    CLI Entry Point                          │
│  `src/index.ts`  (commander, arg parsing, main())          │
└────────────────────────────┬────────────────────────────────┘
                             │  loadConfig() → AppConfig
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                    Browser Layer                            │
│  `src/browser/launchBrowser.ts`                            │
│  `src/browser/attachTradingViewPage.ts`                    │
└────────────────────────────┬────────────────────────────────┘
                             │  Playwright Page handle
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                    Run Orchestrator                         │
│  `src/run/runReplayCapture.ts`                             │
│  State machine: IDLE → WAITING_FOR_USER_READY →            │
│  READING_TARGET_DATE → ADVANCING_BAR →                     │
│  WAITING_FOR_VISUAL_CHANGE → WAITING_FOR_STABLE_FRAME →    │
│  READING_CURRENT_DATE → CAPTURING_SCREENSHOT →             │
│  SAVING_OUTPUT → CHECKING_STOP_CONDITION → DONE            │
└────┬───────────────────┬──────────────────┬────────────────┘
     │                   │                  │
     ▼                   ▼                  ▼
┌──────────────┐ ┌──────────────┐ ┌─────────────────────────┐
│ TradingView  │ │   Capture    │ │       Output            │
│  Module      │ │   Module     │ │  `src/run/             │
│ `src/        │ │  `src/       │ │   writeRunSummary.ts`  │
│  tradingview/│ │   capture/`  │ │   output/<date>-tv-bt/ │
│`             │ │              │ │   run-summary.json     │
└──────────────┘ └──────────────┘ └─────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| CLI Entry | Arg parsing (commander), config assembly, main() lifecycle | `src/index.ts` |
| Config | Zod schema validation, defaults, `AppConfig` type | `src/config.ts` |
| launchBrowser | Launch Chromium persistent context (headed, with profile) | `src/browser/launchBrowser.ts` |
| attachTradingViewPage | Find existing TradingView tab or open a new one | `src/browser/attachTradingViewPage.ts` |
| runReplayCapture | State machine loop: advance bars, wait, capture | `src/run/runReplayCapture.ts` |
| writeRunSummary | Persist `run-summary.json` to output directory | `src/run/writeRunSummary.ts` |
| findChartCanvas | Locate chart `<canvas>` element in the DOM | `src/tradingview/findChartCanvas.ts` |
| findReplayControls | Locate Next Bar button, detect replay toolbar | `src/tradingview/findReplayControls.ts` |
| stepNextBar | Click Next Bar with retry logic | `src/tradingview/stepNextBar.ts` |
| readCurrentDate | Screenshot canvas → extract date via OCR pipeline | `src/tradingview/readCurrentDate.ts` |
| selectors | Centralised DOM selector map (update here when TradingView changes) | `src/tradingview/selectors.ts` |
| hashImage | SHA-256 hash of a PNG buffer for visual-change detection | `src/capture/hashImage.ts` |
| waitForVisualChange | Poll until hash differs from baseline | `src/capture/waitForVisualChange.ts` |
| waitForStableFrame | Poll until N consecutive hashes match | `src/capture/waitForStableFrame.ts` |
| saveScreenshot | Write full-page screenshot to disk (creating dirs) | `src/capture/saveScreenshot.ts` |
| formatFileName | Build deterministic filename from symbol/date/barIndex | `src/utils/formatFileName.ts` |
| logger | Pino logger with pino-pretty in dev, JSON in prod | `src/utils/logger.ts` |
| sleep | Promise-based delay helper | `src/utils/sleep.ts` |

## Pattern Overview

**Overall:** Command-line automation tool using an explicit state machine

**Key Characteristics:**
- Single process, single Playwright `BrowserContext` and `Page` — no parallelism
- Explicit `State` enum drives the loop (`src/types.ts`) and every transition is logged
- Two stop modes: `manual` (Enter key via readline) and `date` (OCR comparison after each bar)
- Config is assembled once at startup from CLI flags + npm config vars, validated with Zod
- All cross-cutting I/O uses the `logger` singleton; no `console.log` in library code (only in `runReplayCapture.ts` for user-facing progress)

## Layers

**CLI Layer:**
- Purpose: Parse arguments, build config, wire top-level dependencies, handle exit
- Location: `src/index.ts`
- Contains: Commander setup, `main()` async function, error handler
- Depends on: `src/config.ts`, `src/browser/`, `src/run/`
- Used by: Node process directly (`tsx src/index.ts`)

**Config Layer:**
- Purpose: Centralise all runtime parameters under a single validated type
- Location: `src/config.ts`, `src/types.ts`
- Contains: Zod schema, `loadConfig()`, `AppConfig` type, `State` enum, `BarCapture`, `RunSummary`, `RunState`
- Depends on: zod
- Used by: every other module via the `AppConfig` argument

**Browser Layer:**
- Purpose: Manage Playwright browser lifecycle and page attachment
- Location: `src/browser/`
- Contains: `launchBrowser.ts`, `attachTradingViewPage.ts`
- Depends on: playwright, `AppConfig`
- Used by: `src/index.ts` only

**Run Orchestrator Layer:**
- Purpose: Drive the bar-by-bar capture loop via a state machine
- Location: `src/run/runReplayCapture.ts`
- Contains: State transitions, stop-mode logic, OCR retry loop, per-bar error accumulation
- Depends on: all other layers
- Used by: `src/index.ts`

**TradingView Interaction Layer:**
- Purpose: All DOM-level actions specific to TradingView
- Location: `src/tradingview/`
- Contains: `findChartCanvas.ts`, `findReplayControls.ts`, `stepNextBar.ts`, `readCurrentDate.ts`, `selectors.ts`
- Depends on: playwright, sharp, tesseract.js, `src/utils/`
- Used by: `src/run/runReplayCapture.ts`

**Capture Layer:**
- Purpose: Screenshot hashing and visual-stability polling (browser-agnostic utilities)
- Location: `src/capture/`
- Contains: `hashImage.ts`, `waitForVisualChange.ts`, `waitForStableFrame.ts`, `saveScreenshot.ts`
- Depends on: playwright (Page handle), node crypto
- Used by: `src/run/runReplayCapture.ts`

**Utils Layer:**
- Purpose: Thin, stateless helpers shared across layers
- Location: `src/utils/`
- Contains: `logger.ts`, `formatFileName.ts`, `sleep.ts`
- Depends on: pino, pino-pretty
- Used by: all layers

## Data Flow

### Primary Request Path (per bar, date stop mode)

1. CLI parses args and calls `loadConfig()` → `AppConfig` (`src/index.ts:51`)
2. `launchBrowser(config)` → persistent `BrowserContext` (`src/browser/launchBrowser.ts`)
3. `attachTradingViewPage(context, config)` → `Page` (`src/browser/attachTradingViewPage.ts`)
4. `runReplayCapture(page, config)` enters state machine (`src/run/runReplayCapture.ts:106`)
5. User ready prompt (optional) → `findChartCanvas(page)` → canvas `ElementHandle`
6. Target date resolved: CLI flag > npm config var > OCR of canvas via `readCurrentDate()`
7. **Per-bar loop:**
   a. Baseline screenshot → `hashImage()` → `baselineHash`
   b. `stepNextBar(page, barIndex)` clicks Next Bar button
   c. `waitForVisualChange(page, { baselineHash, ... })` polls until hash changes
   d. `waitForStableFrame(page, ...)` polls until N consecutive identical hashes
   e. *(date mode only)* `readCurrentDate()` → OCR pipeline → `currentDate`
   f. Stop condition checked: `currentDate > targetDate` → break
   g. `saveScreenshot(page, filePath)` → PNG written to `output/<date>-tv-bt/`
   h. `BarCapture` record pushed to `runState.bars`
8. `writeRunSummary(summary)` → `run-summary.json` (`src/run/writeRunSummary.ts`)
9. `terminateOcrWorker()` destroys tesseract.js worker
10. `browserContext.close()` in `finally` block

### OCR Pipeline (inside `readCurrentDate`)

1. Screenshot `SELECTORS.dateBadgeCanvas` (specific left-pane canvas) or fall back to detected chart canvas
2. Save buffer to `tmp/canvas-latest.png` always (for debugging)
3. Crop bottom-right 600×120 px search strip
4. Pixel-scan for TradingView brand blue `#2962FF` via `detectBlueBadge()`
5. Extract bounding box of bottommost blue cluster (two-pass algorithm)
6. Crop badge, trim 28 px from left (skip calendar icon)
7. Upscale ×4 with nearest-neighbour kernel (sharp)
8. Tesseract.js OCR with char whitelist `0-9 -:`, `PSM.SINGLE_LINE`, auto-invert
9. Regex extract `YYYY-MM-DD` and `HH:MM[:SS]` from OCR text
10. Return `DateTimeReading | null`

### Manual Stop Flow

1. `createManualStopController(true)` opens a readline interface listening on stdin
2. Any Enter keypress sets `stopRequested = true`
3. Main loop checks `manualStopController.isStopRequested()` at start of each bar and after `saveScreenshot`
4. Controller is closed in `finally` to avoid leaving stdin locked

**State Management:**
- `RunState` object tracks `targetDate`, `outputDir`, `barIndex`, `bars[]`, `errors[]` across the loop
- `currentState` (`State` enum) is updated on every transition and logged
- No global mutable state outside the function scope; the OCR worker (`_worker`) is a module-level lazy singleton in `src/tradingview/readCurrentDate.ts`

## Key Abstractions

**AppConfig:**
- Purpose: Single validated config object passed through the entire call chain
- Examples: `src/config.ts`, `src/types.ts`
- Pattern: Zod schema parse once at startup, typed as `AppConfig` thereafter

**State (enum):**
- Purpose: Named states for the bar-capture state machine
- Examples: `src/types.ts`, `src/run/runReplayCapture.ts`
- Pattern: `transition(State.X)` helper logs every state change

**DateTimeReading:**
- Purpose: Structured result of the OCR pipeline
- Examples: `src/tradingview/readCurrentDate.ts`
- Pattern: `{ date: string, time: string | null }` — nullable to signal OCR failure

**SELECTORS constant:**
- Purpose: All TradingView DOM selectors in one place
- Examples: `src/tradingview/selectors.ts`
- Pattern: `as const` object; first-try data-qa-* attributes, fallback to CSS paths

**BarCapture / RunSummary:**
- Purpose: Typed output records
- Examples: `src/types.ts`, `src/run/writeRunSummary.ts`
- Pattern: Accumulated in `RunState.bars[]`, serialised to `run-summary.json` at completion

## Entry Points

**Primary CLI:**
- Location: `src/index.ts`
- Triggers: `npm start` (`tsx src/index.ts`) or `npm run dev` (watch mode)
- Responsibilities: Parse CLI flags, load config, launch browser, attach page, delegate to `runReplayCapture`, handle errors and cleanup

**Dry Run Mode:**
- Location: `src/run/runReplayCapture.ts` (dryRun branch at line ~207)
- Triggers: `--dry-run` flag on CLI
- Responsibilities: Calibration screenshot + OCR debug images, then exit without looping

## Architectural Constraints

- **Threading:** Single-threaded Node.js event loop. The tesseract.js worker runs in a worker thread internally but is managed as a singleton via `_worker` in `src/tradingview/readCurrentDate.ts`.
- **Global state:** One module-level singleton — `_worker` (tesseract.js Worker) in `src/tradingview/readCurrentDate.ts`. Logger singleton in `src/utils/logger.ts` is effectively immutable.
- **Circular imports:** None detected. Dependency direction is strictly: `index → browser/run → tradingview/capture → utils`.
- **Headed browser only:** `headless: false` is hardcoded in `src/types.ts` (`AppConfig.browser.headless: false`) and `src/browser/launchBrowser.ts`. E2E tests override this explicitly with `headless: true`.
- **ESM only:** `"type": "module"` in `package.json`. All imports use `.js` extensions. No CommonJS.

## Anti-Patterns

### OCR worker initialised on first use without explicit warm-up

**What happens:** `getOcrWorker()` in `src/tradingview/readCurrentDate.ts` lazily creates the Tesseract worker on the first `readCurrentDate()` call.
**Why it's wrong:** The first OCR call in a run is slower (worker init takes several seconds) and may appear as a timeout if the wait budget is tight.
**Do this instead:** Call `getOcrWorker()` (or a dedicated warm-up function) during the `WAITING_FOR_USER_READY` phase before the main loop begins, so init cost is not charged against the first bar.

### Selector fragility for `dateBadgeCanvas`

**What happens:** `SELECTORS.dateBadgeCanvas` in `src/tradingview/selectors.ts` is a long nth-child CSS path with no stable attribute.
**Why it's wrong:** TradingView layout changes will silently break OCR; the code falls back to the full chart canvas, which is larger and has lower OCR accuracy.
**Do this instead:** Use a `data-qa-id` or visible-text locator if TradingView exposes one; document the update procedure (already present as a comment) and add a failing test that screenshots the element so breakage is caught automatically.

## Error Handling

**Strategy:** Errors bubble up to `runReplayCapture()` try/catch. Fatal errors transition to `State.ERROR`, write a partial `run-summary.json` (best-effort), and re-throw so `main()` sets `process.exitCode = 1`.

**Patterns:**
- OCR failure is non-fatal: `readCurrentDateWithRetries` retries 3× with 750 ms delay, then returns `null`. In `manual` mode the user is prompted; in `date` mode the loop stops safely.
- `stepNextBar` retries clicks up to 2× with 500 ms delay before throwing.
- `waitForVisualChange` throws on timeout (hard failure — unexpected). `waitForStableFrame` warns and returns the last hash (soft degradation — continues).
- All per-bar errors are pushed to `runState.errors[]` and included in `run-summary.json`.

## Cross-Cutting Concerns

**Logging:** Pino logger (`src/utils/logger.ts`). Structured JSON in production, pino-pretty in dev. Level controlled by `LOG_LEVEL` env var. `logStep`, `logError`, `logWarn` wrappers enforce consistent field shapes.
**Validation:** Zod at config load time only. No runtime validation of TradingView page content beyond Playwright element presence checks.
**Authentication:** None in code. TradingView login is handled by the persistent Chromium profile at `--user-data-dir` (default `./.browser-profile`).

---

*Architecture analysis: 2026-04-29*
