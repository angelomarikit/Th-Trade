import type { TradeSide } from "@wulu/domain";
import type { Bar } from "@wulu/market-data";
import { lastCompletedBar } from "@wulu/market-data";
import { candleAnatomy } from "./candleAnatomy.js";
import { findSwingStructure } from "./swingStructure.js";

export type BreakoutMode = "NONE" | "APPROACHING" | "BREAKING" | "CONFIRMED_CLOSE" | "FAILED_HOLD";

export interface BreakoutAnalysis {
  mode: BreakoutMode;
  side: TradeSide;
  level: number;
  bufferPct: number;
  completedClose: number | null;
  candleTimestamp: string | null;
  closedBeyondLevel: boolean;
  heldIntoClose: boolean;
  closedBackInside: boolean;
  bodyRatio: number | null;
  upperWickRatio: number | null;
  lowerWickRatio: number | null;
  structureTrend: string;
  reason: string;
  iexVolumeDisclaimer: string;
}

export function analyzeBreakout(input: {
  side: TradeSide;
  bars5m: Bar[];
  trigger: number;
  /** Minimum close buffer beyond level (fraction, default 0.05%) */
  bufferPct?: number;
}): BreakoutAnalysis {
  const bufferPct = input.bufferPct ?? 0.0005;
  const level = input.trigger;
  const buffer = level * bufferPct;
  const swing = findSwingStructure(input.bars5m);
  const disclaimer =
    "Volume/participation checks use available feed (often IEX) — not consolidated tape.";

  const forming = input.bars5m.at(-1);
  const last = lastCompletedBar(input.bars5m);

  if (!last) {
    return base(input.side, level, bufferPct, swing.trend, disclaimer, {
      mode: "NONE",
      reason: "Waiting for completed 5-minute candle",
    });
  }

  const anat = candleAnatomy(last);
  const ts = last.timestamp.toISOString();

  if (input.side === "LONG") {
    const beyond = last.close > level + buffer;
    const pierced = last.high >= level;
    const backInside = last.high > level && last.close < level;
    if (backInside) {
      return base(input.side, level, bufferPct, swing.trend, disclaimer, {
        mode: "FAILED_HOLD",
        completedClose: last.close,
        candleTimestamp: ts,
        closedBeyondLevel: false,
        heldIntoClose: false,
        closedBackInside: true,
        bodyRatio: anat.bodyRatio,
        upperWickRatio: anat.upperWickRatio,
        lowerWickRatio: anat.lowerWickRatio,
        reason: `Failed hold: pierced ${level.toFixed(2)} but closed back inside at ${last.close.toFixed(2)}`,
      });
    }
    if (beyond) {
      return base(input.side, level, bufferPct, swing.trend, disclaimer, {
        mode: "CONFIRMED_CLOSE",
        completedClose: last.close,
        candleTimestamp: ts,
        closedBeyondLevel: true,
        heldIntoClose: true,
        closedBackInside: false,
        bodyRatio: anat.bodyRatio,
        upperWickRatio: anat.upperWickRatio,
        lowerWickRatio: anat.lowerWickRatio,
        reason: `Completed 5m close ${last.close.toFixed(2)} > trigger+buffer ${ (level + buffer).toFixed(2) }`,
      });
    }
    if (pierced || (forming && !forming.completed && forming.high >= level)) {
      return base(input.side, level, bufferPct, swing.trend, disclaimer, {
        mode: "BREAKING",
        completedClose: last.close,
        candleTimestamp: ts,
        closedBeyondLevel: false,
        heldIntoClose: false,
        closedBackInside: false,
        bodyRatio: anat.bodyRatio,
        upperWickRatio: anat.upperWickRatio,
        lowerWickRatio: anat.lowerWickRatio,
        reason: "Level tested — waiting for completed close beyond trigger (touch ≠ entry)",
      });
    }
    const dist = (level - last.close) / level;
    return base(input.side, level, bufferPct, swing.trend, disclaimer, {
      mode: dist <= 0.004 ? "APPROACHING" : "NONE",
      completedClose: last.close,
      candleTimestamp: ts,
      closedBeyondLevel: false,
      heldIntoClose: false,
      closedBackInside: false,
      bodyRatio: anat.bodyRatio,
      upperWickRatio: anat.upperWickRatio,
      lowerWickRatio: anat.lowerWickRatio,
      reason:
        dist <= 0.004
          ? `Approaching breakout level ${level.toFixed(2)} (${(dist * 100).toFixed(2)}% below)`
          : `No breakout developing vs ${level.toFixed(2)}`,
    });
  }

  // SHORT
  const beyond = last.close < level - buffer;
  const pierced = last.low <= level;
  const backInside = last.low < level && last.close > level;
  if (backInside) {
    return base(input.side, level, bufferPct, swing.trend, disclaimer, {
      mode: "FAILED_HOLD",
      completedClose: last.close,
      candleTimestamp: ts,
      closedBeyondLevel: false,
      heldIntoClose: false,
      closedBackInside: true,
      bodyRatio: anat.bodyRatio,
      upperWickRatio: anat.upperWickRatio,
      lowerWickRatio: anat.lowerWickRatio,
      reason: `Failed hold: pierced ${level.toFixed(2)} but closed back above at ${last.close.toFixed(2)}`,
    });
  }
  if (beyond) {
    return base(input.side, level, bufferPct, swing.trend, disclaimer, {
      mode: "CONFIRMED_CLOSE",
      completedClose: last.close,
      candleTimestamp: ts,
      closedBeyondLevel: true,
      heldIntoClose: true,
      closedBackInside: false,
      bodyRatio: anat.bodyRatio,
      upperWickRatio: anat.upperWickRatio,
      lowerWickRatio: anat.lowerWickRatio,
      reason: `Completed 5m close ${last.close.toFixed(2)} < trigger-buffer ${(level - buffer).toFixed(2)}`,
    });
  }
  if (pierced || (forming && !forming.completed && forming.low <= level)) {
    return base(input.side, level, bufferPct, swing.trend, disclaimer, {
      mode: "BREAKING",
      completedClose: last.close,
      candleTimestamp: ts,
      closedBeyondLevel: false,
      heldIntoClose: false,
      closedBackInside: false,
      bodyRatio: anat.bodyRatio,
      upperWickRatio: anat.upperWickRatio,
      lowerWickRatio: anat.lowerWickRatio,
      reason: "Level tested — waiting for completed close beyond trigger (touch ≠ entry)",
    });
  }
  const dist = (last.close - level) / level;
  return base(input.side, level, bufferPct, swing.trend, disclaimer, {
    mode: dist <= 0.004 ? "APPROACHING" : "NONE",
    completedClose: last.close,
    candleTimestamp: ts,
    closedBeyondLevel: false,
    heldIntoClose: false,
    closedBackInside: false,
    bodyRatio: anat.bodyRatio,
    upperWickRatio: anat.upperWickRatio,
    lowerWickRatio: anat.lowerWickRatio,
    reason:
      dist <= 0.004
        ? `Approaching breakdown level ${level.toFixed(2)} (${(dist * 100).toFixed(2)}% above)`
        : `No breakdown developing vs ${level.toFixed(2)}`,
  });
}

function base(
  side: TradeSide,
  level: number,
  bufferPct: number,
  structureTrend: string,
  iexVolumeDisclaimer: string,
  partial: Partial<BreakoutAnalysis> & { mode: BreakoutMode; reason: string },
): BreakoutAnalysis {
  return {
    mode: partial.mode,
    side,
    level,
    bufferPct,
    completedClose: partial.completedClose ?? null,
    candleTimestamp: partial.candleTimestamp ?? null,
    closedBeyondLevel: partial.closedBeyondLevel ?? false,
    heldIntoClose: partial.heldIntoClose ?? false,
    closedBackInside: partial.closedBackInside ?? false,
    bodyRatio: partial.bodyRatio ?? null,
    upperWickRatio: partial.upperWickRatio ?? null,
    lowerWickRatio: partial.lowerWickRatio ?? null,
    structureTrend,
    reason: partial.reason,
    iexVolumeDisclaimer,
  };
}
