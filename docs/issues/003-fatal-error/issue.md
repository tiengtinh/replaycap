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


```
  Reading date from chart via OCR...
[02:58:48] INFO (124429): Found 5m chart canvas
    selector: "[data-qa-id=\"pane-top-canvas\"][aria-label*=\"5 minutes\"]"
[02:58:48] INFO (124429): Found Next Bar button
    selector: "[data-role=\"button\"]:has(path[d^=\"M20 6v16\"])"
[02:58:48] INFO (124429): → READING_TARGET_DATE
    state: "READING_TARGET_DATE"
[02:58:48] WARN (124429): Date-badge canvas not found — falling back to detected chart canvas
[02:58:48] INFO (124429): Initializing OCR worker
[02:58:49] INFO (124429): OCR worker ready
[02:58:49] INFO (124429): OCR worker ready
  OCR detected date: 2026-04-29

  Target date : 2026-04-29
  Output dir  : output/2026-04-29-tv-bt
  Max bars    : 500
  Stop mode   : manual (press Enter again to stop after the current bar)


=== Run complete ===
  Bars captured : 0
  Output        : output/2026-04-29-tv-bt
[02:58:49] INFO (124429): Manual stop requested — stopping
    barIndex: 0
[02:58:49] INFO (124429): → DONE
    state: "DONE"
[02:58:49] INFO (124429): Run summary written
    filePath: "output/2026-04-29-tv-bt/run-summary.json"
    barsCaptured: 0
[02:58:49] INFO (124429): OCR worker terminated
```
I did not request manual stop, just hit enter