import { test, expect } from "@playwright/test";
import { chromium } from "playwright";
import path from "path";
import { mkdtemp, rm } from "fs/promises";
import os from "os";
import { hashImage } from "../../src/capture/hashImage.js";
import { waitForStableFrame } from "../../src/capture/waitForStableFrame.js";

test.describe("visual stability detector", () => {
  test("detects stable frame on a static page", async () => {
    const tmpDir = await mkdtemp(path.join(os.tmpdir(), "tv-bt-stable-"));
    const profileDir = path.join(tmpDir, "profile");

    const context = await chromium.launchPersistentContext(profileDir, {
      headless: true,
    });

    try {
      const page = await context.newPage();

      // A simple static HTML page — should stabilize quickly
      await page.setContent(
        "<html><body><h1 style='color:blue'>Stable Page</h1></body></html>"
      );

      const stableHash = await waitForStableFrame(page, {
        pollMs: 100,
        stableFrames: 2,
        timeoutMs: 5_000,
        barIndex: 0,
      });

      expect(stableHash).toHaveLength(64);

      // Verify the hash is reproducible
      const buf = await page.screenshot({ fullPage: false });
      const manualHash = hashImage(buf);
      expect(stableHash).toBe(manualHash);
    } finally {
      await context.close();
      await rm(tmpDir, { recursive: true, force: true });
    }
  });
});
