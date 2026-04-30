import fsExtra from "fs-extra";
const { writeJson, ensureDir } = fsExtra;
import path from "path";
import type { RunSummary } from "../types.js";
import { logger } from "../utils/logger.js";

/**
 * Writes run-summary.json to the output directory.
 * Creates the output directory if it does not exist.
 */
export async function writeRunSummary(summary: RunSummary): Promise<string> {
  const filePath = path.join(summary.outputDirectory, "run-summary.json");
  await ensureDir(summary.outputDirectory);
  await writeJson(filePath, summary, { spaces: 2 });
  logger.info({ filePath, barsCaptured: summary.barsCaptured }, "Run summary written");
  return filePath;
}
