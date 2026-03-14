import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  extractDateFromCanvasBuffer,
  readDateFromBadgeBuffer,
  detectBlueBadge,
  terminateOcrWorker,
} from "../../src/tradingview/readCurrentDate.js";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.join(__dirname, "../fixtures/canvas-2026-03-13.png");
// Debug images written here — inspect them when a test fails
const DEBUG_DIR = path.join(__dirname, "../../tmp/test-debug");

describe("detectBlueBadge", () => {
  it("finds the blue badge in the fixture canvas", async () => {
    const canvasBuf = readFileSync(FIXTURE);
    const meta = await sharp(canvasBuf).metadata();
    const w = meta.width ?? 0;
    const h = meta.height ?? 0;

    // Crop the same strip the pipeline uses
    const stripX = Math.max(0, w - 600);
    const stripY = Math.max(0, h - 120);
    const stripBuf = await sharp(canvasBuf)
      .extract({ left: stripX, top: stripY, width: w - stripX, height: h - stripY })
      .png()
      .toBuffer();

    const { data, info } = await sharp(stripBuf)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const bbox = detectBlueBadge(data, info.width, info.height, info.channels);

    expect(bbox).not.toBeNull();
    expect(bbox!.width).toBeGreaterThan(20);
    expect(bbox!.height).toBeGreaterThan(5);
  });
});

describe("extractDateFromCanvasBuffer", () => {
  it("extracts 2026-03-13 from the fixture canvas", async () => {
    const canvasBuf = readFileSync(FIXTURE);
    // debugDir → writes debug-strip.png, debug-badge-raw.png, debug-badge-ocr.png to tmp/
    const result = await extractDateFromCanvasBuffer(canvasBuf, DEBUG_DIR);

    expect(result).not.toBeNull();
    expect(result!.date).toBe("2026-03-13");
  }, 30_000); // OCR init can take a few seconds

  it("returns null for a blank canvas", async () => {
    const blankBuf = await sharp({
      create: { width: 100, height: 100, channels: 3, background: { r: 30, g: 30, b: 30 } },
    })
      .png()
      .toBuffer();

    const result = await extractDateFromCanvasBuffer(blankBuf);
    expect(result).toBeNull();
  }, 30_000);
});

describe("readDateFromBadgeBuffer", () => {
  it("extracts 2026-03-13 from the badge-raw fixture", async () => {
    const badgeBuf = readFileSync(path.join(__dirname, "../fixtures/badge-raw-2026-03-13.png"));
    const result = await readDateFromBadgeBuffer(badgeBuf, DEBUG_DIR);
    expect(result).not.toBeNull();
    expect(result!.date).toBe("2026-03-13");
  }, 30_000);
});

// Clean up the tesseract worker after all tests
import { afterAll } from "vitest";
afterAll(async () => {
  await terminateOcrWorker();
});
