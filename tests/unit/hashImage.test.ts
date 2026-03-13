import { describe, it, expect } from "vitest";
import { hashImage } from "../../src/capture/hashImage.js";

describe("hashImage", () => {
  it("returns a 64-char hex string", () => {
    const hash = hashImage(Buffer.from("hello"));
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]+$/);
  });

  it("returns the same hash for identical buffers", () => {
    const buf = Buffer.from("test-image-data");
    expect(hashImage(buf)).toBe(hashImage(buf));
  });

  it("returns different hashes for different buffers", () => {
    expect(hashImage(Buffer.from("a"))).not.toBe(hashImage(Buffer.from("b")));
  });

  it("handles empty buffer", () => {
    const hash = hashImage(Buffer.alloc(0));
    expect(hash).toHaveLength(64);
  });
});
