# Codebase Structure

**Analysis Date:** 2026-04-29

## Directory Layout

```
replaycap/
├── src/                        # All application source code (ESM TypeScript)
│   ├── index.ts                # CLI entry point — commander, main()
│   ├── config.ts               # Zod config schema + loadConfig()
│   ├── types.ts                # AppConfig, State enum, BarCapture, RunSummary, RunState
│   ├── browser/                # Playwright browser lifecycle
│   │   ├── launchBrowser.ts    # chromium.launchPersistentContext()
│   │   └── attachTradingViewPage.ts  # Find or open TradingView tab
│   ├── run/                    # Capture orchestration
│   │   ├── runReplayCapture.ts # Main state machine loop
│   │   └── writeRunSummary.ts  # Persist run-summary.json
│   ├── tradingview/            # TradingView-specific DOM automation
│   │   ├── selectors.ts        # All DOM selectors (update here on TV layout change)
│   │   ├── findChartCanvas.ts  # Locate chart canvas element
│   │   ├── findReplayControls.ts  # Locate Next Bar button, detect replay toolbar
│   │   ├── stepNextBar.ts      # Click Next Bar with retry
│   │   └── readCurrentDate.ts  # Screenshot → OCR → DateTimeReading
│   ├── capture/                # Visual-stability and screenshot utilities
│   │   ├── hashImage.ts        # SHA-256 hash of PNG buffer
│   │   ├── waitForVisualChange.ts  # Poll until hash differs from baseline
│   │   ├── waitForStableFrame.ts   # Poll until N consecutive hashes match
│   │   └── saveScreenshot.ts   # Write full-page PNG to disk
│   └── utils/                  # Stateless helpers
│       ├── logger.ts           # Pino logger singleton + logStep/logError/logWarn
│       ├── formatFileName.ts   # Deterministic filename builder
│       └── sleep.ts            # Promise-based delay
├── tests/
│   ├── unit/                   # Vitest unit tests (no browser needed)
│   │   ├── config.test.ts
│   │   ├── formatFileName.test.ts
│   │   ├── hashImage.test.ts
│   │   └── readCurrentDate.test.ts  # OCR pipeline tests against fixtures
│   ├── e2e/                    # Playwright integration tests (real browser)
│   │   ├── browser.spec.ts     # Chromium launch + screenshot
│   │   └── stability.spec.ts   # waitForStableFrame on a static page
│   └── fixtures/               # Static test fixtures (committed)
│       ├── canvas-2026-03-13.png   # Full canvas PNG for OCR tests
│       └── badge-raw-2026-03-13.png  # Pre-cropped badge PNG for readDateFromBadgeBuffer
├── docs/
│   └── PRD.md                  # Product requirements document
├── tmp/                        # Runtime debug images (gitignored, tmp/.gitkeep committed)
│   # canvas-latest.png, badge-raw-latest.png, badge-ocr-latest.png written every run
├── output/                     # Captured screenshots (gitignored)
│   └── <YYYY-MM-DD>-tv-bt/    # One directory per run
│       ├── VN301!__dual__<date>__bar_NNNN[__date_time].png
│       └── run-summary.json
├── .browser-profile/           # Chromium persistent profile (gitignored)
├── .planning/codebase/         # Codebase analysis documents (this directory)
├── package.json                # npm scripts, dependencies
├── tsconfig.json               # TypeScript config (ESNext modules, ES2022 target)
├── vitest.config.ts            # Vitest config (tests/unit only)
├── playwright.config.ts        # Playwright config (tests/e2e, 60s timeout)
├── eng.traineddata             # Tesseract English trained data (committed)
└── .gitignore
```

## Directory Purposes

**`src/browser/`:**
- Purpose: Playwright browser and page lifecycle only
- Contains: Context launch, tab attachment
- Key files: `launchBrowser.ts`, `attachTradingViewPage.ts`

**`src/run/`:**
- Purpose: Top-level capture orchestration
- Contains: State machine loop, output summary writer
- Key files: `runReplayCapture.ts`, `writeRunSummary.ts`

**`src/tradingview/`:**
- Purpose: All TradingView-specific DOM knowledge
- Contains: Selectors, canvas detection, replay controls, OCR date reader
- Key files: `selectors.ts` (update first when TV changes), `readCurrentDate.ts` (OCR pipeline)

**`src/capture/`:**
- Purpose: Visual-stability primitives independent of TradingView specifics
- Contains: Image hashing, change detection, stability polling, screenshot saving
- Key files: `hashImage.ts`, `waitForVisualChange.ts`, `waitForStableFrame.ts`

**`src/utils/`:**
- Purpose: Thin, reusable helpers with no application-specific logic
- Contains: Logger, filename formatter, sleep
- Key files: `logger.ts`, `formatFileName.ts`

**`tests/unit/`:**
- Purpose: Fast, browser-free Vitest tests for pure logic and the OCR pipeline
- Contains: Tests for config, filename, hashing, and OCR against fixture PNGs
- Key files: `readCurrentDate.test.ts` (heaviest — initialises tesseract.js)

**`tests/e2e/`:**
- Purpose: Playwright tests that exercise real Chromium
- Contains: Browser launch smoke test, visual-stability detector integration test

**`tests/fixtures/`:**
- Purpose: Committed PNG files for deterministic OCR tests
- Contains: `canvas-2026-03-13.png` (full canvas), `badge-raw-2026-03-13.png` (cropped badge)
- Generated: No — manually captured and committed

**`tmp/`:**
- Purpose: Runtime debug images written during every live run
- Contains: `canvas-latest.png`, `badge-raw-latest.png`, `badge-ocr-latest.png`
- Generated: Yes (at runtime)
- Committed: No (gitignored, `tmp/.gitkeep` committed to preserve dir)

**`output/`:**
- Purpose: Captured bar screenshots and run summaries
- Contains: `<date>-tv-bt/` subdirectories with PNGs and `run-summary.json`
- Generated: Yes (at runtime)
- Committed: No (gitignored)

**`eng.traineddata`:**
- Purpose: Tesseract English language model for OCR
- Generated: No — downloaded and committed
- Committed: Yes

## Key File Locations

**Entry Points:**
- `src/index.ts`: CLI entry — `npm start` / `tsx src/index.ts`

**Configuration:**
- `src/config.ts`: Zod schema, `loadConfig()`, `defaultConfig`
- `src/types.ts`: All shared TypeScript types and the `State` enum
- `src/tradingview/selectors.ts`: All TradingView DOM selectors

**Core Logic:**
- `src/run/runReplayCapture.ts`: Main state machine — bar loop, stop modes, error handling
- `src/tradingview/readCurrentDate.ts`: OCR pipeline — `extractDateFromCanvasBuffer()`, `readDateFromBadgeBuffer()`, `detectBlueBadge()`

**Testing:**
- `tests/unit/readCurrentDate.test.ts`: OCR tests — requires `tests/fixtures/`
- `tests/fixtures/`: Static PNGs for deterministic OCR assertions
- `vitest.config.ts`: Unit test runner config
- `playwright.config.ts`: E2E test runner config

**Output:**
- `src/run/writeRunSummary.ts`: Writes `run-summary.json`
- `src/utils/formatFileName.ts`: Defines `VN301!__dual__<date>__bar_NNNN[__date_time].png` pattern

## Naming Conventions

**Files:**
- camelCase for all TypeScript source files: `runReplayCapture.ts`, `waitForStableFrame.ts`
- `*.test.ts` suffix for Vitest unit tests
- `*.spec.ts` suffix for Playwright e2e tests
- Prefixes indicate function: `find*`, `wait*`, `read*`, `save*`, `step*`, `write*`

**Directories:**
- lowercase, no separators: `browser/`, `tradingview/`, `capture/`, `utils/`, `run/`

**Functions:**
- camelCase, verb-first: `launchBrowser`, `findChartCanvas`, `readCurrentDate`, `stepNextBar`
- Test suites match the function name they test: `describe("hashImage", ...)`

**Types:**
- PascalCase interfaces and types: `AppConfig`, `RunSummary`, `BarCapture`, `DateTimeReading`
- `const enum` for state: `State`

**Output Files:**
- Screenshot: `VN301!__dual__<targetDate>__bar_<NNNN>[__<barDate>_<barTime>].png`
- Double-underscore separates logical segments
- Colons in time replaced with dashes: `09-31-00`
- Summary: `run-summary.json` in same directory as screenshots

## Where to Add New Code

**New TradingView DOM interaction:**
- Add selector to `src/tradingview/selectors.ts`
- Add interaction function to `src/tradingview/` (e.g., `src/tradingview/findVolumeBar.ts`)
- Import and call from `src/run/runReplayCapture.ts` at the appropriate state

**New stop mode (beyond `manual` and `date`):**
- Extend `stopMode` union in `src/types.ts` (`AppConfig.run.stopMode`)
- Update Zod enum in `src/config.ts`
- Add stop condition check in the main loop in `src/run/runReplayCapture.ts`
- Add CLI option in `src/index.ts`

**New capture utility (browser-agnostic):**
- Add to `src/capture/` with a `wait*` or `hash*` prefix
- Unit test in `tests/unit/` against a Playwright headless page if needed

**New configuration parameter:**
- Add to the Zod schema in `src/config.ts`
- Add to `AppConfig` type in `src/types.ts`
- Add CLI flag in `src/index.ts` if it should be user-overridable

**New utility helper:**
- Add to `src/utils/` — keep it stateless and import-free from other `src/` layers

**New test fixture:**
- Place static PNGs in `tests/fixtures/` with a descriptive name including the date
- Reference with `path.join(__dirname, "../fixtures/<name>.png")` in test files

## Special Directories

**`.browser-profile/`:**
- Purpose: Chromium persistent profile (stores TradingView login session)
- Generated: Yes (by Playwright on first run)
- Committed: No (gitignored)

**`tmp/`:**
- Purpose: Always-on debug images for diagnosing OCR failures in live runs
- Generated: Yes (at runtime by `readCurrentDate.ts`)
- Committed: No (gitignored; `tmp/.gitkeep` is committed)

**`output/`:**
- Purpose: Final product — captured bar PNGs and `run-summary.json` per run
- Generated: Yes (by `saveScreenshot` and `writeRunSummary`)
- Committed: No (gitignored)

**`.planning/codebase/`:**
- Purpose: Architecture documentation for GSD planning workflows
- Generated: By GSD map-codebase command
- Committed: Yes

---

*Structure analysis: 2026-04-29*
