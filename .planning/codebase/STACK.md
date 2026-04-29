# Technology Stack

**Analysis Date:** 2026-04-29

## Languages

**Primary:**
- TypeScript 5.9.3 - All source and test code under `src/` and `tests/`

**Secondary:**
- None (pure TypeScript project)

## Runtime

**Environment:**
- Node.js 22+ (stated requirement in `README.md`; no `engines` field in `package.json`)
- ES modules (`"type": "module"` in `package.json`)
- Target: ES2022 (`tsconfig.json` `"target": "ES2022"`)

**Package Manager:**
- npm
- Lockfile: `package-lock.json` present (lockfileVersion 3)

## Frameworks

**Core:**
- None (no web server or application framework — this is a CLI automation tool)

**Browser Automation:**
- Playwright 1.49.0 (resolved: 1.58.2) — headless/headed Chromium control via `@playwright/test`
  - Browser: Chromium only (`chromium.launchPersistentContext`)
  - Config: `playwright.config.ts` — headed mode (`headless: false`), 60s timeout, 1 retry, HTML reporter

**CLI:**
- commander 12.1.0 — CLI argument parsing in `src/index.ts`

**Testing:**
- Vitest 2.1.9 — unit test runner; config in `vitest.config.ts`, tests in `tests/unit/`
- Playwright Test 1.49.0 — E2E test runner; tests in `tests/e2e/`

**Build/Dev:**
- tsx 4.21.0 — TypeScript execution without a build step (`npm start` runs `tsx src/index.ts`)
- TypeScript 5.9.3 — type-checking; `moduleResolution: Bundler`, strict mode on

## Key Dependencies

**Critical:**

- `tesseract.js` 7.0.0 — OCR engine; reads date badges from chart canvas screenshots
  - Used in: `src/tradingview/readCurrentDate.ts`
  - Companion data: `eng.traineddata` (5.2 MB Tesseract English training data at repo root)
  - A lazy singleton worker is initialized once and reused across all bars

- `sharp` 0.33.5 — Image processing pipeline before OCR
  - Used in: `src/tradingview/readCurrentDate.ts`
  - Operations: extract (crop), resize (4x upscale), raw pixel buffer, greyscale, PNG encode

- `playwright` (via `@playwright/test` 1.49.0) — Browser launch, page interaction, screenshots
  - Used throughout `src/browser/`, `src/capture/`, `src/tradingview/`

**Infrastructure:**

- `zod` 3.25.76 — Runtime config validation in `src/config.ts`
- `pino` 9.14.0 — Structured JSON logging; `src/utils/logger.ts`
- `pino-pretty` 13.1.3 — Human-readable log output in development
- `fs-extra` 11.3.4 — `ensureDir` for output directory creation in `src/capture/saveScreenshot.ts`
- Node.js built-ins: `crypto` (SHA-256 image hashing), `readline` (user prompts), `path`, `fs/promises`

## Configuration

**Environment:**
- `LOG_LEVEL` env var — controls pino log level (default: `"info"`)
- `NODE_ENV` env var — when set to `"production"`, disables pino-pretty transport
- No `.env` file required; all runtime settings are CLI flags or hardcoded defaults
- Config is validated at startup via Zod schema in `src/config.ts`

**Key config defaults (all overridable via CLI flags):**
- `browser.userDataDir`: `./.browser-profile`
- `browser.viewport`: 1920x1080
- `tradingView.url`: `https://www.tradingview.com/chart/`
- `tradingView.expectedSymbol`: `VN301!`
- `run.outputRoot`: `./output`
- `run.maxBars`: 500
- `run.stopMode`: `"manual"` (alternative: `"date"` for OCR-driven auto-stop)
- `settle.pollMs`: 200, `settle.stableFrames`: 3, `settle.firstChangeTimeoutMs`: 10000, `settle.stableTimeoutMs`: 15000

**Build:**
- `tsconfig.json` — `outDir: dist`, `rootDir: src`, `strict: true`, `resolveJsonModule: true`, declaration + sourcemap output
- No build step required for running; `tsx` executes TypeScript directly

## Platform Requirements

**Development:**
- Node.js 22+
- Chromium browser installed via `npx playwright install chromium`
- A TradingView account with the target chart layout open in the browser

**Production:**
- Same as development — this is a personal-use local automation script, not a deployed service
- `.browser-profile/` directory created automatically on first run to persist the TradingView login session

## OCR Data File

- `eng.traineddata` (5.2 MB) — Tesseract English language training data, committed at repo root
- Required by `tesseract.js` `createWorker("eng", ...)` call in `src/tradingview/readCurrentDate.ts`
- Without this file, OCR initialization will fail

---

*Stack analysis: 2026-04-29*
