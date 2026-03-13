import { createHash } from "crypto";

/**
 * Returns a SHA-256 hex digest of the given image buffer.
 * Used to detect visual changes between consecutive screenshots.
 */
export function hashImage(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}
