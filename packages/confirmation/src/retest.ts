import type { TradeSide } from "@wulu/domain";
import type { Bar } from "@wulu/market-data";
import { lastCompletedBar } from "@wulu/market-data";

export type RetestPhase =
  | "NONE"
  | "BROKE"
  | "WAITING_RETEST"
  | "RETESTING"
  | "RETEST_HELD"
  | "RETEST_FAILED"
  | "CONTINUATION_CONFIRMED";

export interface RetestState {
  phase: RetestPhase;
  model: "CONFIRMED_BREAKOUT" | "BREAK_AND_RETEST" | "NONE";
  level: number;
  breakCandleTimestamp: string | null;
  retestCandleTimestamp: string | null;
  reason: string;
  retestRequired: boolean;
}

export function brokeClose(side: TradeSide, bar: Bar, level: number): boolean {
  return side === "LONG" ? bar.close > level : bar.close < level;
}

/** Wick through level but completed close back inside — failed breakout (TSLA-style). */
export function failedHoldBar(side: TradeSide, bar: Bar, level: number): boolean {
  return side === "LONG"
    ? bar.high > level && bar.close < level
    : bar.low < level && bar.close > level;
}

function nearRetestZone(side: TradeSide, bar: Bar, level: number): boolean {
  return side === "LONG"
    ? bar.low <= level * 1.002 && bar.close >= level * 0.998
    : bar.high >= level * 0.998 && bar.close <= level * 1.002;
}

function retestCloseFailed(side: TradeSide, bar: Bar, level: number): boolean {
  return side === "LONG" ? bar.close < level * 0.997 : bar.close > level * 1.003;
}

function firstBreakIndex(side: TradeSide, completed: Bar[], level: number): number {
  return completed.findIndex((b) => brokeClose(side, b, level));
}

/**
 * Tracks break → retest → continuation using completed candles only.
 * previousPhase should be persisted by caller across evaluations for the same setupId.
 */
export function evaluateRetest(input: {
  side: TradeSide;
  bars5m: Bar[];
  level: number;
  previousPhase?: RetestPhase;
  /** Prefer retest model when true (configurable). Default false = allow Model A. */
  preferRetestModel?: boolean;
}): RetestState {
  const preferRetest = input.preferRetestModel ?? false;
  const last = lastCompletedBar(input.bars5m);
  const completed = input.bars5m.filter((b) => b.completed);
  const prevPhase = input.previousPhase ?? "NONE";
  const level = input.level;

  if (!last || completed.length < 2) {
    return {
      phase: "NONE",
      model: "NONE",
      level,
      breakCandleTimestamp: null,
      retestCandleTimestamp: null,
      reason: "Waiting for completed candles for retest logic",
      retestRequired: preferRetest,
    };
  }

  const ts = last.timestamp.toISOString();

  if (prevPhase === "RETEST_FAILED") {
    const wickFail = failedHoldBar(input.side, last, level);
    return {
      phase: "RETEST_FAILED",
      model: "BREAK_AND_RETEST",
      level,
      breakCandleTimestamp: null,
      retestCandleTimestamp: wickFail ? ts : null,
      reason: wickFail
        ? `Failed break (sticky): wick beyond ${level.toFixed(2)} but close ${last.close.toFixed(2)} back inside — do not enter on touch`
        : "Setup invalidated after failed retest — sticky until fresh structure",
      retestRequired: true,
    };
  }

  if (prevPhase === "WAITING_RETEST" || prevPhase === "RETESTING") {
    const near = nearRetestZone(input.side, last, level);
    if (retestCloseFailed(input.side, last, level)) {
      return {
        phase: "RETEST_FAILED",
        model: "BREAK_AND_RETEST",
        level,
        breakCandleTimestamp: null,
        retestCandleTimestamp: ts,
        reason: "Retest failed — level did not hold on completed candle",
        retestRequired: true,
      };
    }
    if (near) {
      const held =
        input.side === "LONG" ? last.close >= level : last.close <= level;
      if (held) {
        return {
          phase: "RETEST_HELD",
          model: "BREAK_AND_RETEST",
          level,
          breakCandleTimestamp: null,
          retestCandleTimestamp: ts,
          reason: "Retest held — waiting for continuation close away from level",
          retestRequired: true,
        };
      }
      return {
        phase: "RETESTING",
        model: "BREAK_AND_RETEST",
        level,
        breakCandleTimestamp: null,
        retestCandleTimestamp: ts,
        reason: "Price revisiting breakout area — retest in progress",
        retestRequired: true,
      };
    }
    return {
      phase: "WAITING_RETEST",
      model: "BREAK_AND_RETEST",
      level,
      breakCandleTimestamp: null,
      retestCandleTimestamp: null,
      reason: "Waiting for price to retest the breakout level",
      retestRequired: true,
    };
  }

  if (prevPhase === "RETEST_HELD") {
    const continuation =
      input.side === "LONG" ? last.close > level * 1.001 : last.close < level * 0.999;
    if (continuation) {
      return {
        phase: "CONTINUATION_CONFIRMED",
        model: "BREAK_AND_RETEST",
        level,
        breakCandleTimestamp: null,
        retestCandleTimestamp: null,
        reason: "Continuation close after held retest (Model B)",
        retestRequired: true,
      };
    }
    return {
      phase: "RETEST_HELD",
      model: "BREAK_AND_RETEST",
      level,
      breakCandleTimestamp: null,
      retestCandleTimestamp: null,
      reason: "Retest held — waiting for continuation candle",
      retestRequired: true,
    };
  }

  if (prevPhase === "CONTINUATION_CONFIRMED") {
    return {
      phase: "CONTINUATION_CONFIRMED",
      model: "BREAK_AND_RETEST",
      level,
      breakCandleTimestamp: null,
      retestCandleTimestamp: null,
      reason: "Continuation confirmed — Model B path complete",
      retestRequired: true,
    };
  }

  const fromHistory = inferRetestFromHistory({
    side: input.side,
    completed,
    last,
    level,
    preferRetest,
  });
  if (fromHistory) return fromHistory;

  const broke = brokeClose(input.side, last, level);
  if (prevPhase === "NONE" || prevPhase === "BROKE") {
    if (broke) {
      if (!preferRetest) {
        return {
          phase: "BROKE",
          model: "CONFIRMED_BREAKOUT",
          level,
          breakCandleTimestamp: ts,
          retestCandleTimestamp: null,
          reason:
            "Completed break candle — Model A (confirmed breakout) path available if other checks pass",
          retestRequired: false,
        };
      }
      return {
        phase: "WAITING_RETEST",
        model: "BREAK_AND_RETEST",
        level,
        breakCandleTimestamp: ts,
        retestCandleTimestamp: null,
        reason: "Break confirmed — waiting for retest of level (Model B)",
        retestRequired: true,
      };
    }
  }

  return {
    phase: broke ? "BROKE" : "NONE",
    model: broke && !preferRetest ? "CONFIRMED_BREAKOUT" : "NONE",
    level,
    breakCandleTimestamp: broke ? ts : null,
    retestCandleTimestamp: null,
    reason: broke ? "Break observed" : "No break/retest sequence active",
    retestRequired: preferRetest,
  };
}

function inferRetestFromHistory(input: {
  side: TradeSide;
  completed: Bar[];
  last: Bar;
  level: number;
  preferRetest: boolean;
}): RetestState | null {
  const breakIdx = firstBreakIndex(input.side, input.completed, input.level);
  if (breakIdx < 0) return null;

  const breakBar = input.completed[breakIdx]!;
  const breakTs = breakBar.timestamp.toISOString();
  const level = input.level;

  if (failedHoldBar(input.side, input.last, level)) {
    return {
      phase: "RETEST_FAILED",
      model: "BREAK_AND_RETEST",
      level,
      breakCandleTimestamp: breakTs,
      retestCandleTimestamp: input.last.timestamp.toISOString(),
      reason: `Failed break: wick beyond ${level.toFixed(2)} but close ${input.last.close.toFixed(2)} back inside — wait/skip, not touch entry`,
      retestRequired: true,
    };
  }

  if (!input.preferRetest) {
    if (brokeClose(input.side, input.last, level)) {
      return {
        phase: "BROKE",
        model: "CONFIRMED_BREAKOUT",
        level,
        breakCandleTimestamp: breakTs,
        retestCandleTimestamp: null,
        reason: "Break sequence in window — Model A path if gates pass",
        retestRequired: false,
      };
    }
    return {
      phase: "WAITING_RETEST",
      model: "BREAK_AND_RETEST",
      level,
      breakCandleTimestamp: breakTs,
      retestCandleTimestamp: null,
      reason: "Break observed earlier — waiting for retest confirmation",
      retestRequired: false,
    };
  }

  const lastIdx = input.completed.length - 1;
  if (breakIdx >= lastIdx) {
    return {
      phase: "WAITING_RETEST",
      model: "BREAK_AND_RETEST",
      level,
      breakCandleTimestamp: breakTs,
      retestCandleTimestamp: null,
      reason: "Break confirmed — waiting for retest of level (Model B)",
      retestRequired: true,
    };
  }

  if (nearRetestZone(input.side, input.last, level)) {
    const held =
      input.side === "LONG" ? input.last.close >= level : input.last.close <= level;
    if (held) {
      return {
        phase: "RETEST_HELD",
        model: "BREAK_AND_RETEST",
        level,
        breakCandleTimestamp: breakTs,
        retestCandleTimestamp: input.last.timestamp.toISOString(),
        reason: "Retest held — waiting for continuation close away from level",
        retestRequired: true,
      };
    }
    return {
      phase: "RETESTING",
      model: "BREAK_AND_RETEST",
      level,
      breakCandleTimestamp: breakTs,
      retestCandleTimestamp: input.last.timestamp.toISOString(),
      reason: "Price revisiting breakout area — retest in progress",
      retestRequired: true,
    };
  }

  if (breakIdx < input.completed.length - 1) {
    return {
      phase: "WAITING_RETEST",
      model: "BREAK_AND_RETEST",
      level,
      breakCandleTimestamp: breakTs,
      retestCandleTimestamp: null,
      reason: "Break confirmed — waiting for retest of level (Model B)",
      retestRequired: true,
    };
  }

  return null;
}
