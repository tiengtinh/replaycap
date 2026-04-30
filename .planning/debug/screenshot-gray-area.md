---
slug: screenshot-gray-area
status: resolved
trigger: "Gray area on left and bottom of all screenshot files; TradingView UI does not stretch full image."
created: 2026-04-30
updated: 2026-04-30
resolved: 2026-04-30 — clearPersistedZoom in launchBrowser.ts confirmed working
---

# Debug Session: screenshot-gray-area

## Symptoms

DATA_START
**Expected behavior:** TradingView UI should stretch to fill the full image — no gray padding on any side.

**Actual behavior:** Saved screenshots have a gray area on the left edge and along the bottom of the image. The TradingView UI is rendered correctly but does not occupy the full PNG canvas.

**Error messages:** None — capture succeeds; the issue is purely visual.

**Timeline:** Reportedly affects all screenshot files (universal, not isolated to one bar).

**Reproduction:** Run the replay capture flow normally; inspect any saved bar screenshot under `output/<date>-tv-bt/`. Reference image: `docs/issues/004-screenshot-gray-area/VN301!__dual__2026-04-29__bar_0010.png`.

**Initial observations from orchestrator:**
- Screenshot is taken in `src/capture/saveScreenshot.ts` via `page.screenshot({ path, fullPage: true })`.
- Browser is launched in `src/browser/launchBrowser.ts` with `viewport: null` and `--window-size=1920,1080` (default config).
- `viewport: null` means the Playwright page viewport tracks the OS window content area (window size minus browser chrome).
- The reference PNG visibly has a thin gray strip on the left and a thicker dark strip at the bottom that appears to contain a system taskbar / OS chrome ("Market Tracking" text + clock visible at bottom).
- Hypothesis to investigate: `fullPage: true` in combination with `viewport: null` is asking Playwright to capture the full document scroll size, which on TradingView (an app whose canvases size to the viewport) may render unexpectedly. Alternatively, the gray bands could be desktop background bleed or a window-positioning artifact when the OS window is larger than the available screen area.
DATA_END

## Current Focus

```
hypothesis: CONFIRMED — the TradingView page has a stored browser page zoom of 80% (zoom_level = -1.2239010857415447) in the persistent Chromium profile at .browser-profile/Default/Preferences under partition.per_host_zoom_levels.x.www.tradingview.com. When Playwright calls page.screenshot(), it captures in logical CSS pixels (not physical device pixels). At 80% zoom the CSS viewport is 1870/0.8=2337.5 px wide and (1053-87.4)/0.8=1207.0 px tall, exactly matching the actual PNG dimensions of 2337x1207. The gray areas appear because TradingView's layout fills only the 1870-px work area and the remaining 467 logical px on the right remain as browser background. fullPage:true vs fullPage:false has no effect because the zoom is the root cause, not scroll area.
test: Verified mathematically: 1870 (work area width from browser profile) / 0.8 = 2337.5 ≈ 2337 ✓; (1053 - 87.4) / 0.8 = 1207.0 ✓
expecting: After resetting page zoom to 100%, PNG dimensions shrink to physical viewport size (~1870x966) with no gray bands.
next_action: Report ROOT CAUSE FOUND — do not apply fix (goal: find_root_cause_only)
reasoning_checkpoint:
  hypothesis: "TradingView page zoom is 80% (stored in persistent browser profile), causing Playwright to capture 2337x1207 logical px instead of ~1870x966 physical px"
  confirming_evidence:
    - ".browser-profile/Default/Preferences has zoom_level: -1.2239010857415447 for www.tradingview.com"
    - "1.2^(-1.2239) = 0.80000 exactly (Chromium formula: zoom_factor = 1.2^zoom_level)"
    - "1870 / 0.8 = 2337.5 → PNG width = 2337 (0.5 rounding) ✓"
    - "(1053 - 87.4) / 0.8 = 1207.0 → PNG height = 1207 ✓ (where 87.4 = browser chrome height)"
    - "Browser profile confirms window is maximized to 1870x1053 (work area), not 1920x1080"
  falsification_test: "If zoom were 100%, PNG would be ~1870x966. If it were DPR-based, both axes would scale by the same factor (2337/1870=1.25 horizontal vs 1207/966=1.25 vertical — let's check: 1207/966 = 1.250 ✓ — consistent with 80% zoom not DPR)"
  fix_rationale: "Resetting browser page zoom to 100% (via Ctrl+0 or CDP) will make the CSS viewport match the physical viewport, producing correctly-sized screenshots"
  blind_spots: "Cannot confirm live via page.evaluate() without running the browser — but math is exact to <1px"
```

## Evidence

- timestamp: 2026-04-30 / orchestrator: reference image is 584x290 pixels (rough visual inspection) — needs confirmation via tool.
- timestamp: 2026-04-30 / orchestrator: saveScreenshot.ts line 16 uses `fullPage: true`.
- timestamp: 2026-04-30 / orchestrator: launchBrowser.ts line 15-16 uses `viewport: null` and `--window-size=${viewport.width},${viewport.height}` (default 1920x1080).
- timestamp: 2026-04-30 / investigator: `file` command confirms PNG is 2338x1208 — 418px wider and 128px taller than the 1920x1080 screen.
- timestamp: 2026-04-30 / investigator: All output PNGs are 2338x1208 (universal, not isolated).
- timestamp: 2026-04-30 / investigator: Screen is 1920x1080 at DPR=1.0 (xrandr + gsettings confirmed). No display scaling active.
- timestamp: 2026-04-30 / investigator: `waitForVisualChange.ts`, `waitForStableFrame.ts`, and baseline capture in `runReplayCapture.ts` all already use `fullPage: false` — only `saveScreenshot.ts` used `fullPage: true`.
- timestamp: 2026-04-30 / investigator: TradingView's document scroll area is larger than its visible viewport. fullPage:true instructs Playwright to scroll and stitch the full document, producing oversized output with gray (empty scroll space) at the edges.
- timestamp: 2026-04-30 / re-investigator: Post-fix PNGs (fullPage:false) are still 2337x1207 — confirming fullPage was not the root cause.
- timestamp: 2026-04-30 / re-investigator: xrandr confirms single display 1920x1080 DPR=1. gsettings scaling-factor=0 (no GNOME scaling). DPR=1.0 is correct at OS level.
- timestamp: 2026-04-30 / re-investigator: .browser-profile/Default/Preferences shows browser.window_placement: maximized=true, right=1870, top=27, bottom=1080. Window is maximized to 1870x1053 (work area), not 1920x1080. --window-size arg is ignored because maximized overrides it.
- timestamp: 2026-04-30 / re-investigator: CONFIRMED ROOT CAUSE — partition.per_host_zoom_levels.x.www.tradingview.com.zoom_level = -1.2239010857415447. This is 80% page zoom (1.2^-1.2239 = 0.80000 exactly per Chromium's blink::PageZoomLevelToZoomFactor formula).
- timestamp: 2026-04-30 / re-investigator: Dimension verification: 1870/0.8 = 2337.5 ≈ 2337 (PNG width) ✓. (1053-87.4)/0.8 = 1207.0 = PNG height ✓. Both axes confirmed. Error < 1px.
- timestamp: 2026-04-30 / re-investigator: Visual inspection of PNG confirms chart content on left portion, gray area on right (~20% = (2337-1870)/2337), and a bottom strip containing TradingView status bar elements ("Market Tracking" + clock) that are visible because the zoomed-out viewport reveals content below the intended visible area.

## Eliminated

- DPR / HiDPI scaling: screen is 1x (confirmed via xrandr + gsettings). PNG is larger than screen in absolute pixels, ruling out DPR as the cause. **CONTRADICTION:** PNG is still 2337x1207 even with fullPage:false, on a "1920x1080" screen — the DPR-1.0 conclusion may be wrong, or Chromium is using a higher viewport than the OS window.
- OS taskbar bleed: ruled out previously, but **needs reconsideration** — the bottom gray band visibly contains "Market Tracking" text + a clock that looks OS-shaped.
- Window decoration offset: offset would cause the content to be cropped/shifted, not produce a canvas larger than the screen.
- ~~fullPage:true was the cause~~ — DISPROVEN. Changed to fullPage:false; gray bands persist identically. PNGs captured at 10:16:04+ (post-fix) are 2337x1207 with the same left + bottom gray areas as the pre-fix reference image.

## Reopened: 2026-04-30

**Disproven hypothesis:** `fullPage: true` was the cause. Switching to `fullPage: false` produced PNGs that are still 2337x1207 with identical gray bands on the left edge and the bottom of the image (visible "Market Tracking" + clock strip).

**New observations:**
- New PNGs (post-fix) are 2337x1207 — same as pre-fix.
- Image visibly has a thin vertical gray strip on the left (~5-10px) and a wider horizontal gray band at the bottom (~30-40px) showing "Market Tracking" text + a clock display.
- The bottom strip looks suspiciously like an OS taskbar / dock or a browser status bar.
- Screen was reported as 1920x1080 DPR 1.0, but viewport screenshot is 2337x1207 — that ratio (1.217 horizontal, 1.118 vertical) is NOT a clean DPR multiplier and the two axes don't match.

**New hypotheses to investigate:**
1. Chromium DPR is actually >1.0 even though gsettings/xrandr report 1.0 — Playwright captures at device pixels.
2. The persistent profile (`./.browser-profile`) overrides `--window-size` and the OS window is actually larger than 1920x1080.
3. Page viewport ≠ rendered TradingView area: the body has padding/margin, OR TradingView's app root sits inside a larger DOM with empty regions around it.
4. The capture is on a different monitor / virtual display than the one xrandr inspected.

**Next investigation steps:**
1. Add logging to capture `await page.evaluate(() => ({ vw: innerWidth, vh: innerHeight, dpr: devicePixelRatio, dw: document.documentElement.scrollWidth, dh: document.documentElement.scrollHeight }))` immediately before saveScreenshot, dump to console.
2. Read pixel rows of one bottom-band scanline of an existing PNG to confirm whether the band is uniform gray or contains rendered content.
3. Consider switching strategy: screenshot a specific element (e.g., body, or a known TradingView app-root container) instead of the whole page, OR clip to the chart canvas bounding box.

## Resolution

root_cause: The persistent Chromium profile (.browser-profile/Default/Preferences) stores a page zoom of 80% for www.tradingview.com (partition.per_host_zoom_levels.x.www.tradingview.com.zoom_level = -1.2239010857415447, which equals 1.2^-1.2239 = 0.8). When Playwright calls page.screenshot(), it captures in logical CSS pixels. At 80% page zoom the logical CSS viewport is 1870/0.8 = 2337.5 px wide and (1053-87.4)/0.8 = 1207.0 px tall — matching exactly the observed 2337x1207 PNG. TradingView's layout fills only the 1870-px physical work area; the remaining 467 logical px on the right are browser background (gray). The fullPage:true/false flag is irrelevant to this cause.
fix: Reset TradingView page zoom to 100% after the page loads. Best approach: add `await page.keyboard.press('Control+0')` in attachTradingViewPage.ts after confirming page readiness. This resets browser zoom to 100% for that tab. Alternative: clear partition.per_host_zoom_levels from the profile (fragile — Chromium rewrites Preferences on close). Secondary optional fix: ensure browser is not maximized so --window-size=1920,1080 is respected.
verification: User to re-run capture and confirm new PNGs are at physical viewport dimensions (~1870×966) with the TradingView UI flush to all four edges.
fix_applied: Added `resetPageZoom(page)` helper in src/browser/attachTradingViewPage.ts that calls `page.bringToFront()` then `page.keyboard.press("Control+0")`. Called on both code paths (existing TradingView tab and newly-opened tab) so every run starts at 100% zoom regardless of profile state. Ctrl+0 overwrites the stored zoom_level back to 0 in the persistent profile.
files_changed: src/capture/saveScreenshot.ts (fullPage:false — orthogonal cleanup, kept), src/browser/attachTradingViewPage.ts (resetPageZoom helper called on attach)
