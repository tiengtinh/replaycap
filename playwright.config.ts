import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  retries: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    headless: false,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "off",
  },
});
