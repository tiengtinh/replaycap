---
slug: cant-detect-blue-badge
status: resolved
trigger: |
  DATA_START
  Source: docs/issues/001-cant-detect-blue-badge/issue.md
  Blue date badge detection fails at startup OCR even though the badge is visibly present in the chart's date axis (see screenshot).
  DATA_END
created: 2026-04-30
updated: 2026-04-30
---

# Debug Session: cant-detect-blue-badge

## Symptoms

DATA_START
**Expected behavior:**
At startup, the OCR pipeline should locate the blue date badge in the chart's bottom date axis and read the target date from it.

**Actual behavior:**
- "Date-badge canvas not found — falling back to detected chart canvas"
- "No blue badge found in search strip"
- "OCR could not read date from captured canvas" (source: detectedChartCanvas)
- Retries also fail; falls back to manual prompt: "Enter target date (YYYY-MM-DD)"

**Error messages / logs:**
```
[02:12:06] INFO Found 5m chart canvas
    selector: "[data-qa-id=\"pane-top-canvas\"][aria-label*=\"5 minutes\"]"
[02:12:06] INFO Found Next Bar button
    selector: "[data-role=\"button\"]:has(path[d^=\"M20 6v16\"])"
[02:12:06] INFO → READING_TARGET_DATE
[02:12:06] WARN Date-badge canvas not found — falling back to detected chart canvas
[02:12:06] WARN No blue badge found in search strip
[02:12:06] WARN OCR could not read date from captured canvas
    source: "detectedChartCanvas"
[02:12:06] WARN OCR returned no date — retrying  attempt: 1  phase: "targetDate"
[02:12:07] WARN Date-badge canvas not found — falling back to detected chart canvas
[02:12:07] WARN No blue badge found in search strip
[02:12:07] WARN OCR could not read date from captured canvas
[02:12:07] WARN OCR returned no date — retrying  attempt: 2  phase: "targetDate"
[02:12:08] WARN Startup OCR failed in manual mode — prompting for target date
```

**Timeline:**
Reported now (2026-04-30). Recent commit 58f97d2 "feat(replay): harden OCR date detection" may be relevant.

**Reproduction:**
1. Launch tool in manual mode with TradingView replay open
2. Tool enters READING_TARGET_DATE state
3. Date-badge canvas not found → falls back to detected chart canvas
4. Blue-badge search in fallback canvas returns no match
5. OCR fails twice, then prompts for manual date entry

**Visual evidence:**
Screenshot at docs/issues/001-cant-detect-blue-badge/Screenshot from 2026-04-30 09-19-17.png
shows two TradingView chart panes, each with a clearly visible blue date badge at the bottom-right of the date axis. So the badge exists in the DOM/render — but the detector cannot find it.
DATA_END

## Current Focus

```yaml
hypothesis: resolved
test: verified via pixel analysis on tmp/canvas-latest.png and tests/fixtures/canvas-2026-03-13.png
expecting: badge detected and OCR succeeds
next_action: done
reasoning_checkpoint: "Two compounding bugs in detectBlueBadge pipeline"
tdd_checkpoint: ""
```

## Evidence

- timestamp: 2026-04-30T09:32
  finding: "SELECTORS.dateBadgeCanvas uses a deeply nested structural CSS path that no longer matches TradingView DOM — first warning 'Date-badge canvas not found' always fires, fallback activates"
  source: src/tradingview/selectors.ts line 25-26

- timestamp: 2026-04-30T09:32
  finding: "Canvas height grew from 622px (fixture) to 786px (current). SEARCH_STRIP_HEIGHT was hardcoded to 120px. Strip starts at y=666 but badge sits at y=592-612 — badge was entirely above the strip."
  source: pixel analysis of tmp/canvas-latest.png

- timestamp: 2026-04-30T09:32
  finding: "With the strip extended to 35% of canvas height (275px, starting at y=511), badge enters the strip BUT a blue oscillator line at canvas y=681-694 sits below the badge. detectBlueBadge anchors on the bottom-most blue row regardless of run length, finds oscillator line, counts only 24 pixels in its cluster (< MIN_BLUE_PIXELS=80), returns null."
  source: pixel analysis, row-by-row run length analysis

- timestamp: 2026-04-30T09:32
  finding: "Badge rows have max contiguous blue run of 65-82px. Oscillator line rows have max run of 33-35px. Setting MIN_BADGE_ROW_RUN=40 in Pass 1 of detectBlueBadge cleanly discriminates badge from oscillator lines."
  source: pixel analysis confirming both canvases

## Eliminated

- "Color threshold wrong" — blue pixels at (38, 88, 225) pass isBlue check; color is fine
- "Badge not in canvas" — badge IS in pane-top-canvas at y=592-612; canvas captures it
- "Commit 58f97d2 broke badge canvas selector" — the selector was already hardcoded structural CSS since commit 9b5139e (2026-03-14); commit 58f97d2 only added the fallback logic

## Resolution

```yaml
root_cause: |
  Two compounding bugs in src/tradingview/readCurrentDate.ts:
  1. SEARCH_STRIP_HEIGHT was fixed at 120px, tuned for a 622px canvas. The canvas grew
     to 786px (wider browser window), pushing the strip start to y=666, while the badge
     sits at y=592-612 — completely above the strip.
  2. With the strip extended, a blue oscillator line at y=681-694 (BELOW the badge) caused
     detectBlueBadge Pass 1 to anchor on the wrong row. The oscillator cluster had only
     24 blue pixels (< MIN_BLUE_PIXELS=80), returning null and missing the badge entirely.
fix: |
  In src/tradingview/readCurrentDate.ts:
  - Replaced SEARCH_STRIP_HEIGHT=120 (fixed px) with SEARCH_STRIP_HEIGHT_FRACTION=0.35
    (35% of canvas height) with SEARCH_STRIP_HEIGHT_MIN=150 floor. This makes the strip
    275px on a 786px canvas, covering the badge.
  - Added maxBlueRunInRow() helper and MIN_BADGE_ROW_RUN=40. Pass 1 of detectBlueBadge
    now scans bottom-up for the bottommost row whose longest *contiguous* blue run >= 40px.
    Badge rows run 65-82px contiguous; oscillator rows run 33-35px — threshold 40 cleanly
    separates them. The algorithm now anchors on the badge, not the oscillator line.
verification: "npm test — all 22 tests pass including extractDateFromCanvasBuffer; pixel simulation on both 786px and 622px canvases confirms badge bbox detected correctly."
files_changed:
  - src/tradingview/readCurrentDate.ts
```
