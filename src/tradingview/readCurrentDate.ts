import type { Page, ElementHandle } from "playwright";
import sharp from "sharp";
import { createWorker, PSM } from "tesseract.js";
import { logger } from "../utils/logger.js";

export type DateTimeReading = {
  date: string;
  time: string | null;
};

// How much of the canvas bottom to scan for the badge (px)
const SEARCH_STRIP_HEIGHT = 120;
// How much of the right side to include in the search (px from right edge)
const SEARCH_STRIP_WIDTH = 600;
// Minimum blue pixels required to consider a badge found
const MIN_BLUE_PIXELS = 80;
// Padding added around the detected badge before OCR (px)
const BADGE_PADDING = 4;
// Upscale factor for OCR (larger = more accurate for small text)
const OCR_SCALE = 4;
// Pixels to trim from the left of the detected badge before OCR.
// The badge layout is: [calendar icon] [day number] [date text]
// Trimming skips the icon region to reduce OCR noise before the date digits.
const BADGE_LEFT_TRIM = 28;

const DATE_PATTERN = /\d{4}-\d{2}-\d{2}/;
const TIME_PATTERN = /\d{2}:\d{2}(?::\d{2})?/;

// Path to save canvas debug images during live runs
const TMP_DIR = "./tmp";

/** Lazy singleton tesseract worker — reused across bars to avoid re-init cost. */
let _worker: Awaited<ReturnType<typeof createWorker>> | null = null;

async function getOcrWorker() {
  if (!_worker) {
    logger.info("Initializing OCR worker");
    _worker = await createWorker("eng", 1, {
      logger: () => {}, // silence verbose tesseract logs
    });
    await _worker.setParameters({
      tessedit_char_whitelist: "0123456789-: ",
      tessedit_pageseg_mode: PSM.SINGLE_LINE,
      // Allow Tesseract to auto-invert when text is lighter than background
      tessedit_do_invert: "1",
    } as Record<string, string>);
    logger.info("OCR worker ready");
  }
  return _worker;
}

export async function terminateOcrWorker(): Promise<void> {
  if (_worker) {
    await _worker.terminate();
    _worker = null;
    logger.info("OCR worker terminated");
  }
}

type BBox = { left: number; top: number; width: number; height: number };

// Max vertical distance from the bottommost blue row to still be part of the badge.
// Keeps us from merging the badge with stray blue chart elements higher in the strip.
const BADGE_VERTICAL_TOLERANCE = 30;

/**
 * Scans raw RGBA pixel data for TradingView brand blue #2962FF (R=41, G=98, B=255)
 * and returns the bounding box of the BOTTOMMOST blue cluster.
 *
 * Two-pass algorithm:
 *   Pass 1 — find the bottommost row (maxY) that contains blue pixels.
 *   Pass 2 — collect only pixels within BADGE_VERTICAL_TOLERANCE rows of maxY.
 *
 * This prevents stray blue chart elements higher in the search strip from
 * inflating the bounding box.
 */
export function detectBlueBadge(
  data: Buffer,
  width: number,
  height: number,
  channels: number
): BBox | null {
  const isBlue = (i: number) => {
    const r = data[i]!;
    const g = data[i + 1]!;
    const b = data[i + 2]!;
    return Math.abs(r - 41) < 40 && Math.abs(g - 98) < 50 && b > 180;
  };

  // Pass 1: find bottommost row with blue pixels
  let bottomRow = -1;
  for (let y = height - 1; y >= 0; y--) {
    for (let x = 0; x < width; x++) {
      if (isBlue((y * width + x) * channels)) {
        bottomRow = y;
        break;
      }
    }
    if (bottomRow !== -1) break;
  }
  if (bottomRow === -1) return null;

  // Pass 2: bounding box of blue pixels within tolerance of bottomRow
  const topLimit = Math.max(0, bottomRow - BADGE_VERTICAL_TOLERANCE);
  let minX = Infinity, minY = Infinity, maxX = -1, maxY = -1;
  let count = 0;

  for (let y = topLimit; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (isBlue((y * width + x) * channels)) {
        count++;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (count < MIN_BLUE_PIXELS || maxX < 0) return null;

  return {
    left: Math.max(0, minX - BADGE_PADDING),
    top: Math.max(0, minY - BADGE_PADDING),
    width: Math.min(width, maxX + BADGE_PADDING) - Math.max(0, minX - BADGE_PADDING),
    height: Math.min(height, maxY + BADGE_PADDING) - Math.max(0, minY - BADGE_PADDING),
  };
}

/**
 * Core date extraction pipeline — works directly on a canvas PNG buffer.
 * No browser required: pass any screenshot of the chart canvas.
 *
 * Steps:
 *   1. Crop the bottom-right search strip
 *   2. Pixel-scan for #2962FF blue badge
 *   3. Crop badge, trim calendar icon from left
 *   4. Upscale → greyscale → invert → OCR
 *   5. Extract YYYY-MM-DD with regex
 *
 * @param canvasBuf  PNG buffer of the full chart canvas
 * @param debugDir   If set, saves intermediate images here for inspection
 */
export async function extractDateFromCanvasBuffer(
  canvasBuf: Buffer,
  debugDir?: string
): Promise<DateTimeReading | null> {
  const canvasMeta = await sharp(canvasBuf).metadata();
  const canvasW = canvasMeta.width ?? 0;
  const canvasH = canvasMeta.height ?? 0;

  // ── 1. Crop search strip (bottom-right corner) ────────────────────────────
  const stripX = Math.max(0, canvasW - SEARCH_STRIP_WIDTH);
  const stripY = Math.max(0, canvasH - SEARCH_STRIP_HEIGHT);
  const stripW = canvasW - stripX;
  const stripH = canvasH - stripY;

  const stripBuf = await sharp(canvasBuf)
    .extract({ left: stripX, top: stripY, width: stripW, height: stripH })
    .png()
    .toBuffer();

  if (debugDir) {
    const fs = await import("fs/promises");
    await fs.mkdir(debugDir, { recursive: true });
    await fs.writeFile(`${debugDir}/debug-strip.png`, stripBuf);
  }

  // ── 2. Detect blue badge ──────────────────────────────────────────────────
  const { data, info } = await sharp(stripBuf)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const badgeBbox = detectBlueBadge(data, info.width, info.height, info.channels);
  if (!badgeBbox) {
    logger.warn("No blue badge found in search strip");
    return null;
  }
  logger.debug({ bbox: badgeBbox }, "Blue badge detected");

  // ── 3. Crop badge + trim calendar icon ───────────────────────────────────
  const rawBadgeBuf = await sharp(stripBuf).extract(badgeBbox).png().toBuffer();

  if (debugDir) {
    const fs = await import("fs/promises");
    await fs.writeFile(`${debugDir}/debug-badge-raw.png`, rawBadgeBuf);
  }

  const badgeMeta = await sharp(rawBadgeBuf).metadata();
  const badgeW = badgeMeta.width ?? 0;
  const badgeH = badgeMeta.height ?? 0;

  // ── 4. Preprocess for OCR ─────────────────────────────────────────────────
  // Badge is white text on #2962FF blue background.
  // Simplest reliable pipeline: resize 4× only, let Tesseract handle the color image.
  // (complex greyscale/threshold chains were producing blank output)
  const processedBuf = await sharp(rawBadgeBuf)
    .resize({ width: badgeW * OCR_SCALE, height: badgeH * OCR_SCALE, kernel: "nearest" })
    .png()
    .toBuffer();

  if (debugDir) {
    const fs = await import("fs/promises");
    await fs.writeFile(`${debugDir}/debug-badge-ocr.png`, processedBuf);
  }

  // ── 5. OCR ────────────────────────────────────────────────────────────────
  const worker = await getOcrWorker();
  const { data: { text } } = await worker.recognize(processedBuf);
  const cleaned = text.trim();
  logger.debug({ ocrText: cleaned }, "OCR result");

  const dateMatch = DATE_PATTERN.exec(cleaned);
  if (!dateMatch) {
    logger.warn({ ocrText: cleaned }, "OCR found no date pattern");
    return null;
  }

  const timeMatch = TIME_PATTERN.exec(cleaned);
  return { date: dateMatch[0], time: timeMatch ? timeMatch[0] : null };
}

/**
 * Reads the current replay date from a live browser page.
 * Screenshots SELECTORS.dateBadgeCanvas, saves to tmp/ for debugging,
 * then delegates to extractDateFromCanvasBuffer.
 *
 * Update SELECTORS.dateBadgeCanvas in selectors.ts if TradingView changes its layout.
 */
export async function readCurrentDate(
  page: Page,
  _canvas: ElementHandle<Element>,
  debugDir?: string
): Promise<DateTimeReading | null> {
  const { SELECTORS } = await import("./selectors.js");

  const el = await page.$(SELECTORS.dateBadgeCanvas);
  if (!el) {
    logger.warn("Date-badge canvas not found — update SELECTORS.dateBadgeCanvas in selectors.ts");
    return null;
  }

  const canvasBuf = (await el.screenshot()) as Buffer;

  // Always save to tmp/ so you can inspect what was captured
  const fs = await import("fs/promises");
  await fs.mkdir(TMP_DIR, { recursive: true });
  await fs.writeFile(`${TMP_DIR}/canvas-latest.png`, canvasBuf);
  logger.debug({ path: `${TMP_DIR}/canvas-latest.png` }, "Canvas saved to tmp/");

  return extractDateFromCanvasBuffer(canvasBuf, debugDir);
}
