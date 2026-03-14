import { describe, it, expect } from "vitest";
import { loadConfig } from "../../src/config.js";

describe("loadConfig", () => {
  it("returns defaults when called with no overrides", () => {
    const cfg = loadConfig();
    expect(cfg.browser.headless).toBe(false);
    expect(cfg.browser.viewport.width).toBe(1920);
    expect(cfg.browser.viewport.height).toBe(1080);
    expect(cfg.tradingView.expectedSymbol).toBe("VN301!");
    expect(cfg.tradingView.layoutMode).toBe("dual");
    expect(cfg.run.maxBars).toBe(500);
    expect(cfg.run.stopMode).toBe("manual");
    expect(cfg.settle.pollMs).toBe(200);
    expect(cfg.settle.stableFrames).toBe(3);
  });

  it("accepts valid targetDate override", () => {
    const cfg = loadConfig({ run: { targetDate: "2026-03-13" } });
    expect(cfg.run.targetDate).toBe("2026-03-13");
  });

  it("throws on invalid targetDate format", () => {
    expect(() => loadConfig({ run: { targetDate: "13-03-2026" } })).toThrow();
  });

  it("throws on negative maxBars", () => {
    expect(() => loadConfig({ run: { maxBars: -1 } })).toThrow();
  });

  it("accepts settle overrides", () => {
    const cfg = loadConfig({ settle: { pollMs: 150, stableFrames: 2 } });
    expect(cfg.settle.pollMs).toBe(150);
    expect(cfg.settle.stableFrames).toBe(2);
  });

  it("accepts stopMode override", () => {
    const cfg = loadConfig({ run: { stopMode: "date" } });
    expect(cfg.run.stopMode).toBe("date");
  });

  it("accepts userDataDir override", () => {
    const cfg = loadConfig({ browser: { userDataDir: "/tmp/profile" } });
    expect(cfg.browser.userDataDir).toBe("/tmp/profile");
  });
});
