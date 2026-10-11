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

  const broke =
    input.side === "LONG" ? last.close > level : last.close < level;
  const ts = last.timestamp.toISOString();

  if (prevPhase === "NONE" || prevPhase === "BROKE") {
    if (broke) {
      if (!preferRetest) {
        return {
          phase: "BROKE",
          model: "CONFIRMED_BREAKOUT",
          level,
          breakCandleTimestamp: ts,
          retestCandleTimestamp: null,
          reason: "Completed break candle — Model A (confirmed breakout) path available if other checks pass",
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

  if (prevPhase === "WAITING_RETEST" || prevPhase === "RETESTING") {
    const near =
      input.side === "LONG"
        ? last.low <= level * 1.002 && last.close >= level * 0.998
        : last.high >= level * 0.998 && last.close <= level * 1.002;
    const failed =
      input.side === "LONG" ? last.close < level * 0.997 : last.close > level * 1.003;
    if (failed) {
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
    // Still waiting for price to come back
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

  if (prevPhase === "RETEST_FAILED") {
    return {
      phase: "RETEST_FAILED",
      model: "BREAK_AND_RETEST",
      level,
      breakCandleTimestamp: null,
      retestCandleTimestamp: null,
      reason: "Setup invalidated after failed retest",
      retestRequired: true,
    };
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
