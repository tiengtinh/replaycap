import { test, expect } from "@playwright/test";
import { chromium } from "playwright";
import path from "path";
import { mkdtemp, rm } from "fs/promises";
import os from "os";

test.describe("browser launch and screenshot", () => {
  test("launches Chromium, navigates to a page, and saves a screenshot", async () => {
    const tmpDir = await mkdtemp(path.join(os.tmpdir(), "tv-bt-test-"));
    const profileDir = path.join(tmpDir, "profile");
    const screenshotPath = path.join(tmpDir, "test.png");

    const context = await chromium.launchPersistentContext(profileDir, {
      headless: true, // use headless in CI tests
    });

    try {
      const page = await context.newPage();
      await page.goto("about:blank");
      await page.screenshot({ path: screenshotPath, fullPage: true });

      // Verify file exists and has content
      const { stat } = await import("fs/promises");
      const info = await stat(screenshotPath);
      expect(info.size).toBeGreaterThan(0);
    } finally {
      await context.close();
      await rm(tmpDir, { recursive: true, force: true });
    }
  });
});
