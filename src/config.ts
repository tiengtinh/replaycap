import { z } from "zod";
import type { AppConfig } from "./types.js";

const configSchema = z.object({
  browser: z.object({
    headless: z.literal(false).default(false),
    userDataDir: z.string().default("./.browser-profile"),
    viewport: z
      .object({
        width: z.number().int().positive().default(1920),
        height: z.number().int().positive().default(1080),
      })
      .default({}),
  }).default({}),
  tradingView: z.object({
    url: z.string().url().default("https://www.tradingview.com/chart/"),
    expectedSymbol: z.string().default("VN301!"),
    layoutMode: z.literal("dual").default("dual"),
  }).default({}),
  run: z.object({
    outputRoot: z.string().default("./output"),
    targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    maxBars: z.number().int().positive().default(500),
    waitForUserReady: z.boolean().default(true),
    stopMode: z.enum(["manual", "date"]).default("manual"),
  }).default({}),
  settle: z.object({
    pollMs: z.number().int().positive().default(200),
    stableFrames: z.number().int().positive().default(3),
    firstChangeTimeoutMs: z.number().int().positive().default(10_000),
    stableTimeoutMs: z.number().int().positive().default(15_000),
  }).default({}),
});

export function loadConfig(overrides: Record<string, unknown> = {}): AppConfig {
  const raw = {
    ...overrides,
  };
  const result = configSchema.safeParse(raw);
  if (!result.success) {
    throw new Error(`Invalid config: ${result.error.message}`);
  }
  return result.data as AppConfig;
}

export const defaultConfig: AppConfig = loadConfig();
