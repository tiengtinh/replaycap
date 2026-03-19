# replaycap

Automates TradingView Bar Replay — steps through bars one at a time, waits for the chart to fully render, and saves a full-page screenshot after each bar. By default it reads the date once at startup, then keeps capturing until you press Enter again to stop.

Personal use only.

---

## How it works

1. You open TradingView in the browser, load the chart layout, and position the Bar Replay start point manually.
2. You run `npm start` and press Enter when ready.
3. The script reads the current date from the chart via OCR, then loops:
   - Clicks **Next Bar**
   - Waits for the canvas to visually stabilize
   - Saves a full-page screenshot with a deterministic filename
4. By default, you press Enter again to stop after the current bar. If startup OCR fails in manual mode, the script prompts you to enter `YYYY-MM-DD` so filenames stay stable. If you use `--stop-mode date`, the script OCRs the date badge after each bar and stops when the date advances past the target day.

---

## Requirements

- Node.js 22+
- A TradingView account (logged in via the persistent browser profile)

---

## Setup

```bash
npm install
npx playwright install chromium
```

---

## Usage

```bash
# Full run — browser opens, press Enter when chart is ready
npm start

# Dry run — takes one screenshot + saves debug images, no loop
npm start -- --dry-run

# Skip the Enter prompt (chart already set up)
npm start -- --no-wait

# Override target date instead of reading via OCR
npm start -- --target-date 2026-03-13

# npm may also expose this as an npm config arg
npm start --target-date=2026-03-13

# Preserve the old auto-stop behavior
npm start -- --stop-mode date

# Custom browser profile and output directory
npm start -- --user-data-dir ./my-profile --output-root ./screenshots
```

On first run a `.browser-profile/` directory is created to persist the TradingView login across runs.

---

## Output

```
output/
  2026-03-13-tv-bt/
    VN301!__dual__2026-03-13__bar_0001.png
    VN301!__dual__2026-03-13__bar_0002.png
    ...
    run-summary.json
```

Use `--stop-mode date` if you want the old behavior: OCR after each bar, automatic stop when the date changes, and filenames that include the detected bar date/time.

---

## Debugging

- **`tmp/canvas-latest.png`** — saved on every live run; shows exactly what canvas the script is reading.
- **Dry run debug images** — `--dry-run` also saves `debug-strip.png`, `debug-badge-raw.png`, and `debug-badge-ocr.png` to the output directory.
- **Playwright tools:**
  ```bash
  npm run codegen   # record new selectors
  npm run trace     # inspect a saved trace file
  ```

---

## If TradingView changes its layout

All DOM selectors are in one file:

```
src/tradingview/selectors.ts
```

To update the chart canvas selector:
1. Open TradingView in Chrome with the dual layout active.
2. Right-click the left chart → Inspect.
3. Find the `<canvas>` element, right-click → Copy → Copy selector.
4. Paste it as `dateBadgeCanvas` in `selectors.ts`.

---

## Tests

```bash
npm test
```

Unit tests cover: filename formatting, config validation, image hashing, and OCR date extraction against a fixture canvas screenshot.

---

## Project structure

```
src/
  index.ts                  CLI entry point
  config.ts                 Zod-validated config with defaults
  types.ts                  Types and state machine enum
  browser/                  Browser launch + page attachment
  tradingview/
    selectors.ts            All DOM selectors (update here on TV layout changes)
    readCurrentDate.ts      OCR pipeline: detect blue badge → Tesseract
    findReplayControls.ts   Next Bar button detection
    stepNextBar.ts          Click + retry logic
  capture/                  Screenshot, hashing, visual stability detection
  run/
    runReplayCapture.ts     Main state machine
    writeRunSummary.ts      run-summary.json writer
  utils/                    Logger, sleep, filename formatter
tests/
  fixtures/                 Sample canvas screenshots for unit tests
  unit/                     Vitest unit tests
  e2e/                      Playwright browser tests
tmp/                        Debug images (gitignored)
output/                     Captured screenshots (gitignored)
```
