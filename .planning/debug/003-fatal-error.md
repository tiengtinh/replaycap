---
slug: 003-fatal-error
status: resolved
trigger: "docs/issues/003-fatal-error/issue.md — Fatal error ENOENT trying to open run-summary.json after manual stop with no bars captured"
created: 2026-04-30T02:52:50Z
updated: 2026-04-30T03:20:00Z
---

# Debug Session: 003-fatal-error

## Symptoms

<DATA_START>
Source: docs/issues/003-fatal-error/issue.md (verbatim observed log)

```
  Reading date from chart via OCR...
  OCR detected date: 2026-04-29

  Target date : 2026-04-29
  Output dir  : output/2026-04-29-tv-bt
  Max bars    : 500
  Stop mode   : manual (press Enter again to stop after the current bar)

[02:49:51] INFO (105030): Found 5m chart canvas
    selector: "[data-qa-id=\"pane-top-canvas\"][aria-label*=\"5 minutes\"]"
[02:49:51] INFO (105030): Found Next Bar button
    selector: "[data-role=\"button\"]:has(path[d^=\"M20 6v16\"])"
[02:49:51] INFO (105030): → READING_TARGET_DATE
    state: "READING_TARGET_DATE"
[02:49:51] WARN (105030): Date-badge canvas not found — falling back to detected chart canvas
[02:49:52] INFO (105030): Initializing OCR worker
[02:49:52] INFO (105030): OCR worker ready
[02:49:52] INFO (105030): Manual stop requested — stopping
    barIndex: 0
[02:49:52] INFO (105030): → DONE
    state: "DONE"
[02:49:52] INFO (105030): → ERROR
    state: "ERROR"
[02:49:52] ERROR (105030): Fatal error
    state: "ERROR"
    error: "ENOENT: no such file or directory, open 'output/2026-04-29-tv-bt/run-summary.json'"
[02:49:52] INFO (105030): OCR worker terminated
[02:49:52] ERROR (105030): Unhandled error
    error: "Error: ENOENT: no such file or directory, open 'output/2026-04-29-tv-bt/run-summary.json'"
```
<DATA_END>

### Expected behavior
After a manual stop (Enter pressed before any bar is captured), the run should exit cleanly without raising a fatal error. Either no summary file is needed, or one should be written gracefully.

### Actual behavior
Process transitions DONE → ERROR and throws `ENOENT: no such file or directory, open 'output/2026-04-29-tv-bt/run-summary.json'`. Then re-throws as `Unhandled error`.

### Error message
`ENOENT: no such file or directory, open 'output/2026-04-29-tv-bt/run-summary.json'`

### Timeline
Surfaced in this session — manual stop requested at `barIndex: 0` immediately after OCR worker became ready, before any bar was captured.

### Reproduction
1. Start the tool.
2. After OCR detects the date and the runner enters its capture loop, press Enter to request a manual stop before any bar is captured (barIndex stays at 0).
3. Observe the fatal `ENOENT` for `run-summary.json` in the output directory.

## Current Focus

- hypothesis: writeRunSummary does not call ensureDir before writing, so when no bar is captured (no screenshot taken, no directory created), the write fails with ENOENT.
- test: trace execution path when manual stop at barIndex=0
- expecting: output directory created before writeRunSummary call
- next_action: RESOLVED — fix applied
- reasoning_checkpoint: The output directory is only created lazily by saveScreenshot (via ensureDir). When user stops before the first bar, saveScreenshot is never called, so the dir never exists. writeRunSummary then fails writing run-summary.json into a non-existent directory.
- tdd_checkpoint: n/a

## Evidence

- timestamp: 2026-04-30T03:05:00Z
  finding: writeRunSummary.ts line 11-12 calls writeJson without ensureDir — no directory creation
  source: src/run/writeRunSummary.ts
  significance: direct cause

- timestamp: 2026-04-30T03:05:00Z
  finding: saveScreenshot.ts calls ensureDir(path.dirname(filePath)) before writing — this is the only place the output dir gets created in normal flow
  source: src/capture/saveScreenshot.ts:15
  significance: pattern to follow

- timestamp: 2026-04-30T03:05:00Z
  finding: runReplayCapture.ts main loop checks isStopRequested() before first iteration (line 251) — if Enter pressed before any bar, breaks immediately without calling saveScreenshot
  source: src/run/runReplayCapture.ts:250-254
  significance: confirms directory never created in zero-bar stop scenario

- timestamp: 2026-04-30T03:05:00Z
  finding: DONE path at line 381 unconditionally calls writeRunSummary regardless of barsCaptured
  source: src/run/runReplayCapture.ts:381
  significance: triggers the ENOENT

## Eliminated

- (hypothesis that ERROR handler is the source) — the ERROR transition and re-throw happen BECAUSE writeRunSummary in the DONE block throws ENOENT first. The catch block re-throws, and the finally block in the caller logs "Unhandled error".

## Resolution

- root_cause: writeRunSummary does not create the output directory before writing. The directory is only created lazily by saveScreenshot. When manual stop occurs before any bar is captured, saveScreenshot is never called, so the directory never exists, and writeRunSummary throws ENOENT.
- fix: Add ensureDir(path.dirname(filePath)) to writeRunSummary.ts before calling writeJson, mirroring the pattern in saveScreenshot.ts.
- verification: After fix, a manual stop at barIndex=0 will create the directory and write the summary cleanly. No ENOENT.
- files_changed: src/run/writeRunSummary.ts

## Follow-up — spurious manual stop on first Enter (2026-04-30)

User reported: after the ENOENT fix, the run still terminates at `barIndex: 0` even though they only pressed Enter once (for the "When ready, press Enter to continue..." prompt), not for a stop.

### Symptom (verbatim, appended to issue.md)

```
Stop mode   : manual (press Enter again to stop after the current bar)

=== Run complete ===
  Bars captured : 0
[02:58:49] INFO (124429): Manual stop requested — stopping
    barIndex: 0
[02:58:49] INFO (124429): → DONE
[02:58:49] INFO (124429): Run summary written
```
User: "I did not request manual stop, just hit enter."

### Root cause

`createManualStopController` was called at the top of `runReplayCapture` (src/run/runReplayCapture.ts:114), registering a `readline.Interface` `'line'` listener on `process.stdin` *before* the "ready" prompt. The "ready" prompt itself calls `promptEnter` → `promptLine` (line 24), which creates a *second* `readline.Interface` on the same `process.stdin`. Both interfaces receive every line event, so the user's single Enter for the ready prompt also fires `handleLine` on the manual-stop controller, flipping `stopRequested = true`. The main loop's first iteration then sees `isStopRequested()` true and breaks immediately. (Same collision would apply to `promptTargetDate` on the OCR-failure path.)

### Fix

src/run/runReplayCapture.ts — defer `createManualStopController(...)` until just before the main loop, after all interactive prompts (`promptEnter`, `promptTargetDate`) have closed their readline interfaces. Declared `manualStopController` as a `let` at the top so the `finally` block can still close it (`manualStopController?.close()`).

### Verification

- `npx tsc --noEmit` passes.
- The "ready" Enter no longer reaches the manual-stop listener (it doesn't exist yet at that point).
- A subsequent Enter pressed after the main loop starts will correctly trigger a manual stop.

### Files changed

- src/run/runReplayCapture.ts
