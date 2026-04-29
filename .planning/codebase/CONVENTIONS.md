# Coding Conventions

**Analysis Date:** 2026-04-29

## Naming Patterns

**Files:**
- One exported function or class per file, filename matches the export: `hashImage.ts` exports `hashImage`, `launchBrowser.ts` exports `launchBrowser`
- camelCase filenames throughout: `formatFileName.ts`, `waitForStableFrame.ts`, `writeRunSummary.ts`
- No index barrel files — each module is imported by its full filename

**Functions:**
- camelCase for all functions: `loadConfig`, `readCurrentDate`, `detectBlueBadge`, `stepNextBar`
- Verb-noun pattern for async operations: `findChartCanvas`, `saveScreenshot`, `waitForVisualChange`, `attachTradingViewPage`
- Boolean-returning functions prefixed with `is`: `isReplayActive`
- Internal/private helpers are module-local (not exported): `getOcrWorker`, `promptEnter`, `createManualStopController`

**Variables:**
- camelCase for local variables and parameters: `barIndex`, `baselineHash`, `stableFrames`
- UPPER_SNAKE_CASE for module-level constants: `OCR_MAX_RETRIES`, `OCR_RETRY_DELAY_MS`, `SEARCH_STRIP_HEIGHT`, `MIN_BLUE_PIXELS`, `MAX_RETRIES`, `DATE_PATTERN`
- Descriptive names — no single-letter variables except loop counters (`x`, `y` in pixel-scan loops)

**Types:**
- PascalCase for `type` and `const enum` declarations: `AppConfig`, `RunSummary`, `BarCapture`, `RunState`, `DateTimeReading`, `BBox`, `LogFields`
- `State` is a `const enum` with UPPER_SNAKE_CASE members: `State.IDLE`, `State.ADVANCING_BAR`
- Type aliases collocated with their primary module (e.g., `DateTimeReading` in `readCurrentDate.ts`, `BBox` internal to same file)
- Shared cross-module types in `src/types.ts`

**Directories:**
- lowercase, noun-based: `browser/`, `capture/`, `run/`, `tradingview/`, `utils/`

## Code Style

**Formatting:**
- No Prettier or ESLint config files present — no automated formatting enforced
- TypeScript strict mode enabled (`"strict": true` in `tsconfig.json`)
- 2-space indentation observed consistently throughout
- Double quotes for strings
- Trailing commas in multi-line arrays/objects
- Template literals for string interpolation
- Numeric literals use `_` separators for readability: `10_000`, `15_000`, `60_000`

**Linting:**
- No ESLint or Biome config — linting relies solely on TypeScript compiler (`tsc`) via `strict: true`
- TypeScript compiler options: `target: ES2022`, `module: ESNext`, `moduleResolution: Bundler`, `declaration: true`, `sourceMap: true`

## Import Organization

**Order (observed pattern):**
1. Node built-ins: `path`, `readline`, `crypto`, `os`, `fs/promises`
2. Third-party packages: `playwright`, `sharp`, `tesseract.js`, `pino`, `commander`, `zod`, `fs-extra`
3. Internal modules using relative paths

**Path Aliases:**
- None — all internal imports use relative paths with explicit `.js` extensions (ESM module resolution): `import { logger } from "../utils/logger.js"`
- `.js` extension required on all relative imports even for `.ts` source files (ESM `"module": "ESNext"` convention)

**Dynamic Imports:**
- Used sparingly for optional/lazy loading: `await import("fs/promises")`, `await import("./selectors.js")` in `readCurrentDate.ts`

## Error Handling

**Patterns:**
- Functions throw `new Error(descriptive message)` for unrecoverable conditions — callers let it propagate
- Multi-line error messages include bullet-point hints for the user (see `runReplayCapture.ts` lines 175-180)
- Retry loops with explicit attempt counting: `for (let attempt = 1; attempt <= MAX_RETRIES; attempt++)`
- Best-effort cleanup wrapped in `try { ... } catch { /* best-effort */ }` in `finally` blocks
- `err instanceof Error ? err.message : String(err)` pattern for safe message extraction
- Top-level `main().catch()` logs and sets `process.exitCode = 1` — no `process.exit()` calls
- `waitForVisualChange` throws on timeout; `waitForStableFrame` degrades gracefully (returns last hash with a warning)

**Zod Validation:**
- Config parsed with `configSchema.safeParse` and throws on invalid input: `throw new Error(`Invalid config: ${result.error.message}`)`

## Logging

**Framework:** `pino` with `pino-pretty` in non-production (`src/utils/logger.ts`)

**Patterns:**
- Structured log calls via wrapper functions: `logStep(fields, msg)`, `logError(fields, msg)`, `logWarn(fields, msg)` — all in `src/utils/logger.ts`
- Direct `logger.info/warn/debug` calls within module-internal logic
- All log calls pass a structured `fields` object as first argument: `logger.info({ barIndex, selector }, "Found Next Bar button")`
- `logStep` used for state-machine transitions; `logError` for fatal errors; `logWarn` for recoverable issues
- Human-readable `console.log` for user-facing progress messages; structured pino for machine-readable logs

## Comments

**When to Comment:**
- JSDoc on all exported functions — describes purpose, parameters, and notable behavior
- Inline comments for non-obvious constants with the reasoning behind values
- Section dividers with `// ── SECTION NAME ────` for long functions (`runReplayCapture.ts`, `readCurrentDate.ts`)
- `HOW TO UPDATE` comment blocks for operationally fragile selectors (`src/tradingview/selectors.ts`)
- Algorithm explanations above multi-pass logic (e.g., two-pass blue-badge detector)

**JSDoc/TSDoc:**
- `/** ... */` block comments on all exported functions and public types
- Parameters documented inline in the prose where important, not with `@param` tags
- `@param` tags not used — plain prose descriptions preferred

## Function Design

**Size:**
- Short pure functions preferred: `hashImage`, `sleep`, `formatFileName` are under 15 lines
- Complex orchestration in one longer function (`runReplayCapture`) with section comments to compensate
- Module-private helper extraction for reusable sub-steps: `readCurrentDateWithRetries`, `promptEnter`, `createManualStopController`

**Parameters:**
- Options objects used when a function takes 3+ related parameters: `waitForStableFrame(page, { pollMs, stableFrames, timeoutMs, barIndex })`
- Simple positional args when 1-2 parameters: `hashImage(buffer)`, `sleep(ms)`
- `opts` naming convention for option objects: `opts.dryRun`, `opts.barIndex`

**Return Values:**
- `null` returned (not `undefined`) to signal "not found" or "failed" from functions that can fail gracefully: `detectBlueBadge`, `readCurrentDate`, `extractDateFromCanvasBuffer`
- `void` return type for side-effect-only functions: `saveScreenshot`, `stepNextBar`
- `Promise<T>` with explicit type annotation on all async exported functions

## Module Design

**Exports:**
- Named exports only — no default exports in `src/`
- Each module exports one primary function/class plus closely related helpers or types
- `src/types.ts` is the exception — pure type definitions for the whole app

**Barrel Files:**
- Not used — every import references the concrete module path

---

*Convention analysis: 2026-04-29*
