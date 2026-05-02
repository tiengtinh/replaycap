# Milestones

Historical record of shipped milestones for ReplayCap.

---

## v1.0 — Capture Loop (shipped 2026-04-29)

**Goal:** Build a local Playwright + TypeScript script that automates TradingView Bar Replay one trading day at a time, captures a full-page screenshot per fully-painted bar, and stops when the on-chart date advances past the target day.

**Shipped capabilities:** see `Validated` in `.planning/PROJECT.md` (CAPTURE-01 through CAPTURE-13).

**Notable post-ship fixes (rolled into v1.0):**
- Issue 001 — blue date badge detection failed on certain themes (`docs/issues/001-cant-detect-blue-badge/`)
- Issue 002 — Ctrl+C did not exit cleanly (`docs/issues/002-cant-exit-with-ctrl-c/`)
- Issue 003 — fatal error during run cleanup (`docs/issues/003-fatal-error/`)
- Issue 004 — captures landed on a gray-area frame (`docs/issues/004-screenshot-gray-area/`)

**Closed under:** commits `7f0bcb4` through `43aeb1c`.

**Outstanding concerns** (deferred to v1.1): zero unit-test coverage on `runReplayCapture.ts` and `createManualStopController`; tight coupling between business logic and Playwright/Tesseract side effects; single-fixture OCR tests; no coverage threshold. See `.planning/codebase/CONCERNS.md`.

---
