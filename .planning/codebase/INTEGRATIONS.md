# External Integrations

**Analysis Date:** 2026-04-29

## APIs & External Services

**TradingView (web application — browser automation, not API):**
- Service: TradingView chart web UI at `https://www.tradingview.com/chart/`
- Integration method: Playwright browser automation (not an official API or SDK)
- Auth: Login session persisted via Chromium persistent profile at `.browser-profile/` (manual login required on first run)
- Selectors: All DOM selectors centralized in `src/tradingview/selectors.ts`
- No API keys, tokens, or webhooks — entirely UI-driven

No other external APIs or web services are used.

## Data Storage

**Databases:**
- None — no database of any kind

**File Storage:**
- Local filesystem only
  - `output/<date>-tv-bt/` — captured screenshots (PNG) and `run-summary.json` per run
  - `tmp/` — debug images written during live runs (`canvas-latest.png`, `badge-raw-latest.png`, `badge-ocr-latest.png`)
  - `.browser-profile/` — Chromium persistent profile (TradingView session cookies/auth)
  - `eng.traineddata` — Tesseract OCR training data (committed, read-only)

**Caching:**
- None

## Authentication & Identity

**Auth Provider:**
- None — no programmatic auth integration
- TradingView session is maintained via a persisted Chromium profile directory (`.browser-profile/`)
- The user manually logs in to TradingView on first run; subsequent runs reuse the saved session

## Monitoring & Observability

**Error Tracking:**
- None (no Sentry, Datadog, etc.)

**Logs:**
- `pino` structured JSON logging via `src/utils/logger.ts`
- Development: pretty-printed via `pino-pretty` (colorized, human-readable timestamps)
- Production (`NODE_ENV=production`): raw JSON to stdout
- Log level controlled by `LOG_LEVEL` env var (default: `info`)
- No log shipping or aggregation

## CI/CD & Deployment

**Hosting:**
- Not applicable — local-only CLI tool, not deployed anywhere

**CI Pipeline:**
- None detected (no `.github/`, `.gitlab-ci.yml`, or similar)

## Environment Configuration

**Required env vars:**
- None required — the tool runs without any environment variables
- Optional: `LOG_LEVEL` (pino log level, default `"info"`)
- Optional: `NODE_ENV` (set to `"production"` to disable pino-pretty)

**Secrets location:**
- No secrets managed by the codebase
- TradingView credentials are stored only in the Chromium profile at `.browser-profile/` (gitignored)

## Webhooks & Callbacks

**Incoming:**
- None

**Outgoing:**
- None

## OCR Integration

**Tesseract.js (local, embedded):**
- Library: `tesseract.js` 7.0.0
- Training data: `eng.traineddata` at repo root (5.2 MB, committed)
- No network calls — OCR runs entirely in-process
- Worker lifecycle: lazy singleton initialized on first OCR call, terminated at run end (`terminateOcrWorker()` in `src/tradingview/readCurrentDate.ts`)
- Image preprocessing pipeline: `sharp` crops, upscales (4x), and converts to PNG before passing to Tesseract

---

*Integration audit: 2026-04-29*
