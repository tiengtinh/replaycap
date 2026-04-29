# Codebase Concerns

**Analysis Date:** 2026-04-29

---

## Tech Debt

**`eng.traineddata` binary committed to git:**
- Issue: The 5 MB Tesseract language model is committed to the repository root as `/eng.traineddata`. It is the tesseract.js runtime cache (default `cachePath` is `.`, i.e., `process.cwd()`). It was auto-downloaded by tesseract.js on first run and then committed — not intentionally vendored.
- Files: `/eng.traineddata`
- Impact: Every `git clone` downloads 5 MB of binary data. The file has an Apache-2.0 license (Tesseract project) that is not documented in the repo. It will be re-downloaded if deleted and the process is run from a different working directory.
- Fix approach: Add `eng.traineddata` to `.gitignore`. If offline availability is required, document the explicit download step in README. Alternatively, pass `langPath: '.'` and `cachePath: '.'` explicitly in `createWorker` options so the cache location is intentional and documented.

**No linter or formatter configured:**
- Issue: No ESLint, Biome, or Prettier config exists. Style consistency is enforced only by convention.
- Files: Project root (no `.eslintrc*`, `eslint.config*`, `biome.json`, `.prettierrc*`)
- Impact: No automated enforcement of code style; drift will accumulate as the codebase grows.
- Fix approach: Add `biome.json` (single tool for lint + format) or `eslint.config.ts` + `.prettierrc`. Add a `lint` and `format` script to `package.json`.

**`defaultConfig` instantiated at module load time in `config.ts`:**
- Issue: `export const defaultConfig: AppConfig = loadConfig()` executes at import time. Any future side-effects in `loadConfig` (e.g., env reads, file I/O) would run whenever `config.ts` is imported, including during tests.
- Files: `src/config.ts:46`
- Impact: Low now, but fragile as configuration complexity grows.
- Fix approach: Remove `defaultConfig` export; callers should construct config explicitly via `loadConfig()`.

**Dynamic `import("fs/promises")` inside hot OCR path:**
- Issue: `readCurrentDate.ts` uses `await import("fs/promises")` five separate times inside `extractDateFromCanvasBuffer` and `readDateFromBadgeBuffer`. Node.js caches dynamic imports after the first resolution, so this is not a performance bug, but it is unexpected and inconsistent with static imports used everywhere else.
- Files: `src/tradingview/readCurrentDate.ts:164`, `186`, `191`, `221`, `226`, `258`, `259`
- Impact: Code clarity and review confusion; no runtime cost after first call.
- Fix approach: Replace all `await import("fs/promises")` with `import fs from "fs/promises"` as a static top-level import.

**Hardcoded `./tmp` relative path:**
- Issue: `TMP_DIR = "./tmp"` in `readCurrentDate.ts` is relative to `process.cwd()`. If the process is launched from a directory other than the project root, debug files land in an unexpected location. The path is also not configurable.
- Files: `src/tradingview/readCurrentDate.ts:30`
- Impact: Confusing debug output when run from a different working directory; no test covers this path.
- Fix approach: Derive `TMP_DIR` from `import.meta.url` (ESM `__dirname` equivalent) or expose it as a config option, or use `os.tmpdir()`.

---

## Known Bugs

**Dual readline interfaces conflict in `manual` stop mode with user-ready prompt:**
- Symptoms: When `stopMode === "manual"` and `waitForUserReady === true` (the default), `createManualStopController` opens a readline interface on `process.stdin` at line 113, and then `promptEnter` immediately opens a second readline interface on the same `process.stdin` at line 142. Two simultaneous readline instances competing for stdin can cause the "ready" Enter press to also trigger `stopRequested = true` on the controller, stopping the run after the very first bar.
- Files: `src/run/runReplayCapture.ts:47-69`, `src/run/runReplayCapture.ts:113`, `src/run/runReplayCapture.ts:142`
- Trigger: Default invocation with `stopMode=manual` and `waitForUserReady=true`.
- Workaround: Pass `--no-wait` to skip the ready prompt, or pass `--stop-mode date`.

**OCR `DATE_PATTERN` regex is not anchored:**
- Symptoms: `DATE_PATTERN = /\d{4}-\d{2}-\d{2}/` matches any substring. If OCR noise produces text like `"X2026-03-13Y"` or `"12026-03-13"`, the regex still extracts a date — but the leading digit could be wrong (e.g., noise produces `"12026-03-13"` and the matched group is `"1202-6-03"` if OCR smudges digits together).
- Files: `src/tradingview/readCurrentDate.ts:26`
- Trigger: Rare OCR corruption where digit noise precedes the year.
- Workaround: Use `DATE_PATTERN = /(?<!\d)\d{4}-\d{2}-\d{2}(?!\d)/` (negative lookaround) to prevent partial digit matches.

**Date comparison uses lexicographic string ordering:**
- Symptoms: `currentDate > targetDate` at line 309 compares ISO date strings lexicographically. This is correct for well-formed `YYYY-MM-DD` strings, but provides no protection if OCR ever returns a semantically invalid date (e.g., `"2026-13-01"`) that passes the regex. Such a date would compare correctly but would not represent a real calendar date.
- Files: `src/run/runReplayCapture.ts:309`
- Impact: Low risk with current OCR whitelist (`0123456789-: `), but no semantic guard exists.
- Fix approach: Add a `new Date(currentDate).getTime()` validity check before comparison.

---

## Security Considerations

**Browser automation detection bypass flag:**
- Risk: `--disable-blink-features=AutomationControlled` is passed to Chromium. This hides the automation flag from JavaScript running inside TradingView's page. This is a ToS consideration for TradingView usage.
- Files: `src/browser/launchBrowser.ts:19`
- Current mitigation: Flag is used; no additional fingerprint spoofing is present.
- Recommendations: Document the ToS implications. This is a personal-use tool against the user's own TradingView account, so risk is low, but worth noting.

**No path sanitization on user-supplied `outputRoot` or `userDataDir`:**
- Risk: `--output-root` and `--user-data-dir` CLI arguments are passed directly into `path.join()` and `chromium.launchPersistentContext()` without sanitization. A path traversal value (e.g., `--output-root ../../../../etc`) would resolve to an arbitrary directory.
- Files: `src/index.ts:51-61`, `src/browser/launchBrowser.ts:14`
- Current mitigation: None. This is a local CLI tool run by the owner, so practical risk is low.
- Recommendations: Add `path.resolve()` + check that the resolved path starts within an expected prefix, or document that arguments are trusted.

**`stopMode` value not type-narrowed before passing to `loadConfig`:**
- Risk: At `src/index.ts:49`, `stopMode` is declared as `string` (the result of `readNpmConfigString` and `??` chain) and cast to `"manual" | "date"` implicitly via the config object. Invalid values (e.g., `npm_config_stop_mode=invalid`) pass TypeScript without error and reach zod, which correctly rejects them — but the error message from zod is generic.
- Files: `src/index.ts:49`
- Impact: Poor UX on misconfiguration; not a security issue.
- Fix approach: Narrow explicitly: `const VALID_STOP_MODES = ["manual", "date"] as const; if (!VALID_STOP_MODES.includes(stopMode)) { ... }`.

---

## Performance Bottlenecks

**OCR runs unconditionally on every bar in `date` stop mode:**
- Problem: In `stopMode === "date"`, `readCurrentDateWithRetries` is called after every single bar advance. Each call takes a screenshot of the canvas, runs image preprocessing (sharp crop, resize ×4), and invokes the tesseract worker. At 500 bars, this is 500 OCR operations.
- Files: `src/run/runReplayCapture.ts:289`, `src/tradingview/readCurrentDate.ts:144-196`
- Cause: Stop condition requires the current date after each bar to know when to halt.
- Improvement path: Sample OCR every N bars (e.g., every 5), relying on date advance direction and bar count estimate to skip intermediate reads. The current 3-retry + 750ms delay can add up to 2.25 seconds per failed OCR cycle.

**Full-page screenshot for visual-change baseline:**
- Problem: `page.screenshot({ fullPage: false })` is called twice per bar: once for the baseline hash before clicking Next Bar, and once per poll inside `waitForVisualChange`. In `date` mode, an additional screenshot is taken inside `readCurrentDate`. Each screenshot is a PNG encode of the full viewport.
- Files: `src/run/runReplayCapture.ts:258-259`, `src/capture/waitForVisualChange.ts:27`, `src/capture/waitForStableFrame.ts:30`
- Cause: No clipping or partial-page capture; entire 1920×1080 viewport is encoded each poll.
- Improvement path: Use `page.screenshot({ clip: { ... } })` scoped to the chart area for hash-based detection; reserve full-page only for the final save.

---

## Fragile Areas

**`dateBadgeCanvas` CSS selector (hardcoded nth-child path):**
- Files: `src/tradingview/selectors.ts:26`
- Why fragile: The selector is a 9-level `:nth-child()` chain tied to TradingView's internal DOM structure. TradingView deploys frequently. The selector was last updated 2026-03-14; any chart layout refactor silently breaks date reading with no immediate error — the fallback path degrades to screenshotting the wrong canvas and returning `null`.
- Safe modification: When updating, follow the "HOW TO UPDATE" instructions in `selectors.ts`. Add a selector-level test that verifies `dateBadgeCanvas` resolves on a real TradingView page.
- Test coverage: No automated test verifies this selector against a live page. Unit tests use saved fixture images, bypassing the selector entirely.

**Blue badge pixel heuristic (`isBlue` tolerance values):**
- Files: `src/tradingview/readCurrentDate.ts:83-88`
- Why fragile: The blue detection uses hardcoded per-channel tolerances: `|r - 41| < 40`, `|g - 98| < 50`, `b > 180`. These values were tuned for TradingView's `#2962FF` brand blue. If TradingView changes its theme colour, the badge detection returns `null` and the entire OCR pipeline silently fails. `MIN_BLUE_PIXELS = 80` is also a magic constant with no justification in tests.
- Safe modification: Changes to any heuristic constant require re-running `readCurrentDate.test.ts` with the fixture. Add a test asserting the specific pixel count range for the known fixture.
- Test coverage: `detectBlueBadge` has one passing test against a single fixture image. No test covers the tolerance boundaries or alternative colour themes.

**`BADGE_LEFT_TRIM = 28` pixel skip:**
- Files: `src/tradingview/readCurrentDate.ts:24`
- Why fragile: The value trims the calendar icon from the left of the badge crop before OCR. It is tuned for the current badge size at `OCR_SCALE = 4`. If TradingView resizes the icon or changes font size, the trim either cuts into the day digits or leaves icon noise, causing OCR to misread the date.
- Safe modification: This constant is not tested in isolation. Testing requires badge fixture images at different zoom levels.
- Test coverage: Only tested implicitly through `readDateFromBadgeBuffer` against one fixture.

**`manualStopController` relies on Node.js `readline` "line" event timing:**
- Files: `src/run/runReplayCapture.ts:47-69`
- Why fragile: The stop controller detects a key press by listening for any `"line"` event on stdin. This means pressing Enter during an OCR retry sleep, during a screenshot, or during any `await` will be buffered and trigger stop on the next check. There is no debounce or confirmation prompt. A mistyped Enter silently stops the run after the current bar with no warning.
- Safe modification: Verify stop intent with a second prompt or require a specific key sequence (e.g., `q\n`).
- Test coverage: Zero — `createManualStopController` has no unit tests. The readline interaction is untestable without stdin mocking.

**Single-fixture OCR test coverage:**
- Files: `tests/unit/readCurrentDate.test.ts`, `tests/fixtures/`
- Why fragile: All OCR tests use a single canvas fixture (`canvas-2026-03-13.png`) from one specific TradingView session. If OCR accuracy regresses for different dates, zoom levels, or DPI settings, no test catches it.
- Safe modification: Add fixtures for edge cases: dates near midnight (time present), time absent, dark mode chart, different bar widths.
- Test coverage: 3 tests, 1 date fixture, 1 badge fixture.

---

## Scaling Limits

**`maxBars` safety limit (default 500):**
- Current capacity: 500 bars per run, configurable via config.
- Limit: Memory is bounded (no in-memory accumulation of screenshots), but the `runState.bars` array grows with one `BarCapture` object per bar. At 500 bars this is negligible, but at very high `maxBars` it could grow large.
- Scaling path: If `maxBars` exceeds ~10,000, stream the bars array to disk incrementally rather than holding all in memory for the final `writeRunSummary`.

**Single TradingView chart session — no parallelism:**
- Current capacity: One chart, one browser, one session per run.
- Limit: Inherent to the design (TradingView Bar Replay is a single-session interactive feature).
- Scaling path: Not applicable; tool is intentionally single-session.

---

## Dependencies at Risk

**`tesseract.js` version pinned to `^7.0.0`:**
- Risk: Major version; API changes between 7.x releases could break `createWorker("eng", 1, {...})` call signature or `PSM` enum values.
- Impact: `src/tradingview/readCurrentDate.ts` would fail to initialize the OCR worker.
- Migration plan: Lock to a specific patch (e.g., `7.0.0`). Review `CHANGELOG.md` on each upgrade.

**`sharp` version `^0.33.5`:**
- Risk: `sharp` has native bindings (libvips). Platform-specific prebuilds can fail on Node version upgrades or new OS versions.
- Impact: All image preprocessing fails; OCR pipeline is completely broken.
- Migration plan: Pin to exact version in `package.json`. Test after any Node.js version change.

**`playwright` at `^1.49.0`:**
- Risk: TradingView may use browser APIs that change in newer Chromium builds included in Playwright updates. `SELECTORS.dateBadgeCanvas` is already a known break point.
- Impact: Selector-based canvas detection could break silently.
- Migration plan: Pin to specific Playwright version; update intentionally.

---

## Missing Critical Features

**No timeout on the initial browser page load for newly opened TradingView tabs:**
- Problem: `attachTradingViewPage` uses `waitForLoadState("domcontentloaded")` with no explicit timeout. If TradingView is slow or unreachable, the process hangs indefinitely.
- Files: `src/browser/attachTradingViewPage.ts:30`
- Blocks: Any recovery path for network issues.

**No run-interruption recovery:**
- Problem: If the process is killed mid-run (Ctrl+C, OOM), the `finally` block calls `manualStopController.close()` and `terminateOcrWorker()`, but `writeRunSummary` is only written if `runState.outputDir` is set (line 406). A crash during `WAITING_FOR_USER_READY` or `READING_TARGET_DATE` (before `outputDir` is set) leaves no summary and no captured bars on disk.
- Files: `src/run/runReplayCapture.ts:406`
- Blocks: Post-mortem analysis of partial runs.

---

## Test Coverage Gaps

**`runReplayCapture.ts` — zero unit test coverage:**
- What's not tested: The entire main loop, state machine transitions, manual stop logic, OCR retry orchestration, error recovery, dry-run path, and `writeRunSummary` call.
- Files: `src/run/runReplayCapture.ts` (415 lines)
- Risk: Regressions in stop logic, bar counting, or error handling are undetectable without a live TradingView session.
- Priority: High

**`createManualStopController` — zero tests:**
- What's not tested: Stop request flag flip, readline lifecycle, close() idempotency, behaviour when `enabled=false`.
- Files: `src/run/runReplayCapture.ts:47-69`
- Risk: The readline conflict bug (described above) is invisible without tests.
- Priority: High

**`findReplayControls.ts` and `stepNextBar.ts` — zero unit tests:**
- What's not tested: Selector fallback order, retry logic in `stepNextBar`, error throw paths.
- Files: `src/tradingview/findReplayControls.ts`, `src/tradingview/stepNextBar.ts`
- Risk: Silent selector breakage or retry loop behaviour cannot be verified offline.
- Priority: Medium

**`waitForVisualChange.ts` — no timeout path test:**
- What's not tested: The timeout throw path (`waitForVisualChange: no change detected within Xms`).
- Files: `src/capture/waitForVisualChange.ts:34`
- Risk: A Playwright update that changes screenshot timing could cause hangs instead of clean errors.
- Priority: Medium

**No coverage enforcement:**
- What's not tested: No `coverage` threshold is configured in `vitest.config.ts`.
- Files: `vitest.config.ts`
- Risk: Coverage regressions go unnoticed.
- Priority: Low

---

*Concerns audit: 2026-04-29*
