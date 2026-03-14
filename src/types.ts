export type AppConfig = {
  browser: {
    headless: false;
    userDataDir: string;
    viewport: {
      width: number;
      height: number;
    };
  };
  tradingView: {
    url: string;
    expectedSymbol: string;
    layoutMode: "dual";
  };
  run: {
    outputRoot: string;
    targetDate?: string;
    maxBars: number;
    waitForUserReady: boolean;
    stopMode: "manual" | "date";
  };
  settle: {
    pollMs: number;
    stableFrames: number;
    firstChangeTimeoutMs: number;
    stableTimeoutMs: number;
  };
};

export const enum State {
  IDLE = "IDLE",
  WAITING_FOR_USER_READY = "WAITING_FOR_USER_READY",
  READING_TARGET_DATE = "READING_TARGET_DATE",
  ADVANCING_BAR = "ADVANCING_BAR",
  WAITING_FOR_VISUAL_CHANGE = "WAITING_FOR_VISUAL_CHANGE",
  WAITING_FOR_STABLE_FRAME = "WAITING_FOR_STABLE_FRAME",
  READING_CURRENT_DATE = "READING_CURRENT_DATE",
  CAPTURING_SCREENSHOT = "CAPTURING_SCREENSHOT",
  SAVING_OUTPUT = "SAVING_OUTPUT",
  CHECKING_STOP_CONDITION = "CHECKING_STOP_CONDITION",
  DONE = "DONE",
  ERROR = "ERROR",
}

export type BarCapture = {
  barIndex: number;
  date: string;
  time: string | null;
  filePath: string;
  elapsedMs: number;
};

export type RunSummary = {
  targetDate: string;
  symbol: string;
  layoutMode: string;
  stopMode: "manual" | "date";
  barsCaptured: number;
  startTime: string;
  endTime: string;
  outputDirectory: string;
  bars: BarCapture[];
  errors: string[];
};

export type RunState = {
  targetDate: string;
  outputDir: string;
  barIndex: number;
  startTime: Date;
  bars: BarCapture[];
  errors: string[];
};
