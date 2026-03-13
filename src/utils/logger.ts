import pino from "pino";

export const logger = pino({
  level: process.env["LOG_LEVEL"] ?? "info",
  transport:
    process.env["NODE_ENV"] !== "production"
      ? {
          target: "pino-pretty",
          options: { colorize: true, translateTime: "HH:MM:ss" },
        }
      : undefined,
});

export type LogFields = {
  state?: string;
  barIndex?: number;
  targetDate?: string;
  currentDate?: string | null;
  filePath?: string;
  elapsedMs?: number;
  error?: string;
  [key: string]: unknown;
};

export function logStep(fields: LogFields, msg: string): void {
  logger.info(fields, msg);
}

export function logError(fields: LogFields, msg: string): void {
  logger.error(fields, msg);
}

export function logWarn(fields: LogFields, msg: string): void {
  logger.warn(fields, msg);
}
