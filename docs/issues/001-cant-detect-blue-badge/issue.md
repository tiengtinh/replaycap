logs:

```
  Reading date from chart via OCR...
[02:12:06] INFO (18489): Found 5m chart canvas
    selector: "[data-qa-id=\"pane-top-canvas\"][aria-label*=\"5 minutes\"]"
[02:12:06] INFO (18489): Found Next Bar button
    selector: "[data-role=\"button\"]:has(path[d^=\"M20 6v16\"])"
[02:12:06] INFO (18489): → READING_TARGET_DATE
    state: "READING_TARGET_DATE"
[02:12:06] WARN (18489): Date-badge canvas not found — falling back to detected chart canvas
[02:12:06] WARN (18489): No blue badge found in search strip
[02:12:06] WARN (18489): OCR could not read date from captured canvas
    source: "detectedChartCanvas"
[02:12:06] WARN (18489): OCR returned no date — retrying
    attempt: 1
    phase: "targetDate"
[02:12:07] WARN (18489): Date-badge canvas not found — falling back to detected chart canvas
[02:12:07] WARN (18489): No blue badge found in search strip
[02:12:07] WARN (18489): OCR could not read date from captured canvas
    source: "detectedChartCanvas"
[02:12:07] WARN (18489): OCR returned no date — retrying
    attempt: 2
    phase: "targetDate"
  OCR failed at startup.
→ Enter target date (YYYY-MM-DD): [02:12:08] WARN (18489): Date-badge canvas not found — falling back to detected chart canvas
[02:12:08] WARN (18489): No blue badge found in search strip
[02:12:08] WARN (18489): OCR could not read date from captured canvas
    source: "detectedChartCanvas"
[02:12:08] WARN (18489): Startup OCR failed in manual mode — prompting for target date
```

but the blue badge is there

see screenshot: "docs/issues/001-cant-detect-blue-badge/Screenshot from 2026-04-30 09-19-17.png"
