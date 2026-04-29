# Testing Patterns

**Analysis Date:** 2026-04-29

## Test Framework

**Unit Runner:**
- Vitest 2.1.8
- Config: `vitest.config.ts` — `include: ["tests/unit/**/*.test.ts"]`, `environment: "node"`

**E2E Runner:**
- Playwright Test 1.49.0
- Config: `playwright.config.ts` — `testDir: "./tests/e2e"`, `timeout: 60_000`, `retries: 1`
- Reporter: `list` (console) + `html` (never auto-open)
- Browser: `headless: false` in production; tests override to `headless: true` explicitly

**Assertion Library:**
- Vitest built-in `expect` (unit tests)
- Playwright `expect` (e2e tests)

**Run Commands:**
```bash
npm test               # Run all unit tests (vitest run)
npm run test:watch     # Unit tests in watch mode (vitest)
npm run test:e2e       # Run e2e tests (playwright test)
npm run trace          # Open Playwright trace viewer
```

## Test File Organization

**Location:**
- Separate `tests/` tree — not co-located with source
- Unit tests: `tests/unit/`
- E2E tests: `tests/e2e/`
- Fixtures (binary image files): `tests/fixtures/`

**Naming:**
- Unit tests: `<moduleUnderTest>.test.ts` matching the source module name (e.g., `hashImage.test.ts` tests `src/capture/hashImage.ts`)
- E2E tests: `<feature>.spec.ts` (e.g., `browser.spec.ts`, `stability.spec.ts`)

**Structure:**
```
tests/
├── e2e/
│   ├── browser.spec.ts      # Chromium launch + screenshot smoke test
│   └── stability.spec.ts    # waitForStableFrame integration test
├── fixtures/
│   ├── badge-raw-2026-03-13.png   # Cropped badge PNG for OCR unit tests
│   └── canvas-2026-03-13.png     # Full canvas PNG for pipeline unit tests
└── unit/
    ├── config.test.ts             # loadConfig validation tests
    ├── formatFileName.test.ts     # formatFileName output tests
    ├── hashImage.test.ts          # hashImage hash property tests
    └── readCurrentDate.test.ts    # OCR pipeline unit tests
```

## Test Structure

**Suite Organization (Vitest):**
```typescript
import { describe, it, expect } from "vitest";

describe("<functionName>", () => {
  it("<description of behaviour>", () => {
    // arrange
    // act
    // assert
  });
});
```

**Suite Organization (Playwright):**
```typescript
import { test, expect } from "@playwright/test";

test.describe("<feature>", () => {
  test("<what it does>", async () => {
    // setup
    // act
    // assert
  });
});
```

**Patterns:**
- No `beforeEach`/`afterEach` — test state created inline per test
- `afterAll` used in `readCurrentDate.test.ts` to shut down the singleton Tesseract worker after all OCR tests complete
- Shared base fixture objects defined as `const` at suite scope and spread-merged per test:
  ```typescript
  const base = { symbol: "VN301!", layoutMode: "dual", targetDate: "2026-03-13", barIndex: 1 };
  it("...", () => { formatFileName({ ...base, barDate: "2026-03-13", barTime: "09:31:00" }); });
  ```
- Long-running async tests (OCR init) use explicit timeout override: `}, 30_000)`

## Mocking

**Framework:** None — no `vi.mock`, `vi.fn`, or `vi.spyOn` used anywhere in the test suite

**Patterns:**
- No mocking at all in unit tests; modules are tested against real implementations
- OCR tests use real Tesseract.js worker with actual PNG fixture files
- E2E tests spin up real Chromium instances with `chromium.launchPersistentContext` in headless mode

**What to Mock:**
- No established mocking pattern yet — tests exercise real code paths

**What NOT to Mock:**
- File I/O, image processing (sharp), and OCR (tesseract.js) are tested with real implementations against fixtures
- Browser automation (Playwright `Page`) tested with real headless Chromium

## Fixtures and Factories

**Test Data:**
- Binary PNG fixtures for image-processing tests:
  - `tests/fixtures/canvas-2026-03-13.png` — full chart canvas screenshot used by `detectBlueBadge` and `extractDateFromCanvasBuffer` tests
  - `tests/fixtures/badge-raw-2026-03-13.png` — pre-cropped blue badge PNG used by `readDateFromBadgeBuffer` test
- Fixtures are committed to the repository and read with `readFileSync`

**Loading Fixtures:**
```typescript
import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.join(__dirname, "../fixtures/canvas-2026-03-13.png");
const canvasBuf = readFileSync(FIXTURE);
```

**Debug Output:**
- Tests that run the OCR pipeline pass `DEBUG_DIR` so intermediate images are saved:
  ```typescript
  const DEBUG_DIR = path.join(__dirname, "../../tmp/test-debug");
  const result = await extractDateFromCanvasBuffer(canvasBuf, DEBUG_DIR);
  ```
- This writes `debug-strip.png`, `debug-badge-raw.png`, `debug-badge-ocr.png` to `tmp/test-debug/` on failure

**Location:**
- Fixtures: `tests/fixtures/`
- Debug output: `tmp/` (gitignored, written at test runtime)

## Coverage

**Requirements:** None enforced — no coverage thresholds configured in `vitest.config.ts`

**View Coverage:**
```bash
npx vitest run --coverage   # (not configured; would require @vitest/coverage-v8)
```

## Test Types

**Unit Tests (`tests/unit/`):**
- Scope: pure functions and stateless modules — `hashImage`, `formatFileName`, `loadConfig`, and the image-processing pipeline in `readCurrentDate`
- Real dependencies used (no mocks): sharp for image manipulation, tesseract.js for OCR, zod for validation
- Test isolation: each test creates its own inputs; no shared mutable state between tests (except the singleton OCR worker cleaned up in `afterAll`)
- Files tested: `src/capture/hashImage.ts`, `src/utils/formatFileName.ts`, `src/config.ts`, `src/tradingview/readCurrentDate.ts`

**Integration / E2E Tests (`tests/e2e/`):**
- Scope: real Chromium browser launched headless; tests `src/browser/` and `src/capture/` against an actual browser page
- `browser.spec.ts` — smoke test: launch Chromium, navigate to `about:blank`, take screenshot, assert file size > 0
- `stability.spec.ts` — integration test: exercise `waitForStableFrame` and `hashImage` on a real static HTML page rendered in Chromium
- Cleanup: each test creates a temp directory via `mkdtemp` and removes it in a `finally` block

**What Is Not Tested:**
- `src/run/runReplayCapture.ts` — main orchestration loop (no unit or e2e test)
- `src/tradingview/stepNextBar.ts`, `findChartCanvas.ts`, `findReplayControls.ts` — browser-dependent, no tests
- `src/browser/attachTradingViewPage.ts`, `src/browser/launchBrowser.ts` — no tests beyond the browser smoke test
- `src/run/writeRunSummary.ts`, `src/capture/saveScreenshot.ts`, `src/capture/waitForVisualChange.ts` — untested

## Common Patterns

**Async Testing (Vitest):**
```typescript
it("extracts date from canvas", async () => {
  const result = await extractDateFromCanvasBuffer(canvasBuf, DEBUG_DIR);
  expect(result).not.toBeNull();
  expect(result!.date).toBe("2026-03-13");
}, 30_000);  // explicit timeout for slow OCR operations
```

**Error/Null Testing:**
```typescript
it("returns null for a blank canvas", async () => {
  const blankBuf = await sharp({ create: { width: 100, height: 100, channels: 3, background: { r: 30, g: 30, b: 30 } } })
    .png().toBuffer();
  const result = await extractDateFromCanvasBuffer(blankBuf);
  expect(result).toBeNull();
}, 30_000);
```

**Validation / Throw Testing:**
```typescript
it("throws on invalid targetDate format", () => {
  expect(() => loadConfig({ run: { targetDate: "13-03-2026" } })).toThrow();
});
```

**Cleanup in E2E (always use `finally`):**
```typescript
const tmpDir = await mkdtemp(path.join(os.tmpdir(), "tv-bt-test-"));
try {
  // ... test body ...
} finally {
  await context.close();
  await rm(tmpDir, { recursive: true, force: true });
}
```

**Worker Teardown (afterAll):**
```typescript
import { afterAll } from "vitest";
afterAll(async () => {
  await terminateOcrWorker();
});
```

---

*Testing analysis: 2026-04-29*
