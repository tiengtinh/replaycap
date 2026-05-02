# ReplayCap — TradingView Bar Replay Auto-Capture

## What This Is

A local Playwright + TypeScript CLI that drives TradingView Bar Replay one bar at a time, waits for the chart to fully render, OCR-reads the on-chart date, and saves a deterministic full-page screenshot per bar to `output/<date>-tv-bt/`. Personal-use only on macOS; the user manually selects the replay start point and the script takes over from there.

## Core Value

Each captured screenshot represents a fully-painted bar with a verified on-chart date — correctness over speed, deterministic stop on the next trading day.

## Requirements

### Validated

<!-- Shipped in v1.0 — confirmed working in production runs. -->

- ✓ **CAPTURE-01**: Launch/attach to persistent Chromium profile so TradingView login survives — `src/browser/launchBrowser.ts` (v1.0)
- ✓ **CAPTURE-02**: Detect TradingView page/tab and chart canvas — `src/browser/attachTradingViewPage.ts`, `src/tradingview/findChartCanvas.ts` (v1.0)
- ✓ **CAPTURE-03**: Manual user-ready gate via terminal Enter — `src/run/runReplayCapture.ts` (v1.0)
- ✓ **CAPTURE-04**: Step Next Bar with retry — `src/tradingview/stepNextBar.ts` (v1.0)
- ✓ **CAPTURE-05**: Visual-change + stable-frame settle detection via SHA-256 hashes — `src/capture/{hashImage,waitForVisualChange,waitForStableFrame}.ts` (v1.0)
- ✓ **CAPTURE-06**: OCR-based date reading from blue date badge — `src/tradingview/readCurrentDate.ts` (v1.0)
- ✓ **CAPTURE-07**: Date-based stop condition (`stopMode=date`) — `src/run/runReplayCapture.ts` (v1.0)
- ✓ **CAPTURE-08**: Manual stop mode via Enter keypress (`stopMode=manual`) — `src/run/runReplayCapture.ts` (v1.0)
- ✓ **CAPTURE-09**: Full-page screenshot with deterministic filename `<symbol>__<layout>__<date>__bar_NNNN[__<barDate>_<barTime>].png` — `src/capture/saveScreenshot.ts`, `src/utils/formatFileName.ts` (v1.0)
- ✓ **CAPTURE-10**: Run summary JSON written at end of run — `src/run/writeRunSummary.ts` (v1.0)
- ✓ **CAPTURE-11**: Dry-run calibration mode — `src/run/runReplayCapture.ts` (v1.0)
- ✓ **CAPTURE-12**: Zod-validated config + CLI flags via commander — `src/config.ts`, `src/index.ts` (v1.0)
- ✓ **CAPTURE-13**: Codebase mapped under `.planning/codebase/` (v1.0)

### Active

<!-- Current scope — defined in REQUIREMENTS.md for milestone v1.1. -->

See `.planning/REQUIREMENTS.md`.

## Current Milestone: v1.1 Lockdown via Tests + Hexagonal Refactor

**Goal:** Refactor ReplayCap along ports & adapters / DDD lines so the capture state machine and business rules become unit-testable without Playwright/Tesseract, then lock down v1.0 with comprehensive unit tests and a coverage threshold.

**Target features:**
- Extract pure domain (capture state machine, stop conditions, filename rules, date comparison, run-summary aggregation) from `src/run/runReplayCapture.ts`
- Define adapter ports for browser navigation, screenshot/hashing, OCR, filesystem, clock, and stdin so Playwright/Tesseract/fs-extra/readline live behind ports
- Comprehensive unit tests on the new domain core + on `createManualStopController`; broaden OCR fixtures
- Add Vitest coverage threshold (strict on domain/application, lenient on adapters)
- Fix the manual+wait readline conflict bug as a root-cause fix during the extraction

### Out of Scope

<!-- Explicit boundaries from PRD + this milestone. -->

- Full automatic TradingView login flow — login is handled via persistent Chromium profile
- Automatic calendar/day selection in replay UI — user picks the start point manually
- Cropped chart export — V1 uses full-page screenshots only
- Cloud deployment / multi-account / parallel sessions — personal-use single-session tool by design
- Production GUI / desktop app — CLI only
- Automatic recovery from login expiration — user re-logs manually
- Linux packaging — macOS first; Linux is a future enhancement
- pnpm migration — npm is in use and acceptable per PRD

## Context

**Status as of 2026-05-02:** v1.0 has shipped — the capture loop runs end-to-end against live TradingView with OCR-driven date stop. Four post-ship issues have been fixed (001 blue-badge detection, 002 Ctrl+C exit, 003 fatal-error handling, 004 screenshot gray area). Codebase has been mapped under `.planning/codebase/`.

**Known concerns (from `.planning/codebase/CONCERNS.md`):**
- `runReplayCapture.ts` (415 lines, the orchestration core) has zero unit-test coverage
- `createManualStopController` has zero tests; a known dual-readline conflict bug exists in manual+wait mode
- TradingView side-effects (DOM clicks, screenshots, OCR) are interleaved with control flow — hard to test without a live browser
- Browser-dependent modules (`stepNextBar`, `findChartCanvas`, `findReplayControls`, `attachTradingViewPage`, `launchBrowser`) have no unit tests
- Single-fixture OCR coverage — no edge cases for dark mode, different zoom, time-absent dates
- No coverage threshold configured

**Why this matters now:** The user wants to lock down existing features with extensive unit testing and refactor the codebase using ports & adapters + DDD so business logic can be tested without spinning up Playwright or Tesseract.

## Constraints

- **Tech stack**: TypeScript 5.9 + Node 22 ESM, Playwright 1.49+, Vitest 2.1, Tesseract.js 7, sharp, zod, pino, commander — locked by PRD
- **Runtime OS**: macOS first (Linux future); single-process, single Playwright context
- **Browser mode**: Headed Chromium with persistent profile (`headless: false` hardcoded for production runs; e2e tests override)
- **Module system**: ESM only (`"type": "module"`); imports use `.js` extensions
- **Package manager**: npm (per PRD allowance; pnpm rejected for this project)
- **No build step in dev**: `tsx` runs TypeScript directly via `npm start`
- **Selectors**: All TradingView DOM selectors live in `src/tradingview/selectors.ts` — single update point on TV layout change
- **Test policy**: No mocking framework currently used — tests run against real implementations with PNG fixtures. Refactor must preserve fast, deterministic unit tests.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Use Tesseract.js for date reading (not DOM) | TradingView date badge is canvas-rendered; no stable DOM text node | ✓ Good — works reliably with brand-blue heuristic |
| Centralize selectors in `selectors.ts` | TradingView ships frequent DOM changes; single update point | ✓ Good |
| Explicit state machine for capture loop | Async control flow on a flaky surface gets brittle without named states | ✓ Good |
| Persistent Chromium profile for login | Avoid coding a full login flow against TradingView ToS | ✓ Good |
| Dual stop modes (manual + date) | OCR can fail; manual gives an escape hatch | ⚠️ Revisit — readline conflict bug in manual+wait combo |
| Commit `eng.traineddata` to repo | Convenience for first-run | ⚠️ Revisit — 5 MB binary, license undocumented |
| Single fixture for OCR tests | Bootstrapped quickly, fast tests | ⚠️ Revisit — milestone v1.1 will broaden fixtures |
| No mocking framework | Real-impl tests catch integration bugs | — Pending — DDD refactor will reframe what gets unit-tested vs integration-tested |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-05-02 after bootstrapping PROJECT.md from PRD.md + .planning/codebase/ ahead of milestone v1.1*
