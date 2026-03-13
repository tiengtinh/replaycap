import { describe, it, expect } from "vitest";
import { formatFileName } from "../../src/utils/formatFileName.js";

describe("formatFileName", () => {
  const base = {
    symbol: "VN301!",
    layoutMode: "dual",
    targetDate: "2026-03-13",
    barIndex: 1,
  };

  it("produces full pattern when date and time are provided", () => {
    const name = formatFileName({
      ...base,
      barDate: "2026-03-13",
      barTime: "09:31:00",
    });
    expect(name).toBe("VN301!__dual__2026-03-13__bar_0001__2026-03-13_09-31-00.png");
  });

  it("produces fallback pattern when time is null", () => {
    const name = formatFileName({
      ...base,
      barDate: "2026-03-13",
      barTime: null,
    });
    expect(name).toBe("VN301!__dual__2026-03-13__bar_0001.png");
  });

  it("produces fallback pattern when date is null", () => {
    const name = formatFileName({ ...base });
    expect(name).toBe("VN301!__dual__2026-03-13__bar_0001.png");
  });

  it("pads bar index to 4 digits", () => {
    const name = formatFileName({ ...base, barIndex: 42 });
    expect(name).toMatch(/bar_0042/);
  });

  it("pads bar index to 4 digits for large values", () => {
    const name = formatFileName({ ...base, barIndex: 1000 });
    expect(name).toMatch(/bar_1000/);
  });

  it("replaces colons in time with dashes", () => {
    const name = formatFileName({
      ...base,
      barDate: "2026-03-13",
      barTime: "09:31:00",
    });
    expect(name).not.toContain(":");
  });

  it("handles HH:MM time without seconds", () => {
    const name = formatFileName({
      ...base,
      barDate: "2026-03-13",
      barTime: "09:31",
    });
    expect(name).toBe("VN301!__dual__2026-03-13__bar_0001__2026-03-13_09-31.png");
  });
});
