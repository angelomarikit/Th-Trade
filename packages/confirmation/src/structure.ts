import type { TradeSide } from "@wulu/domain";
import type { Bar } from "@wulu/market-data";
import { lastCompletedBar } from "@wulu/market-data";

export interface StructureResult {
  pass: boolean;
  waiting: boolean;
  reason: string;
}

/**
 * Simple swing structure:
 * LONG — last completed 5m close > prior 5m high (breakout hold) OR higher low reclaim
 * SHORT — last completed 5m close < prior 5m low
 * Incomplete bar → WAITING (never PASS on forming candle)
 */
export function evaluateStructure(
  bars5m: Bar[],
  side: TradeSide,
): StructureResult {
  const completed = bars5m.filter((b) => b.completed);
  if (completed.length < 3) {
    return {
      pass: false,
      waiting: true,
      reason: "Waiting for enough completed 5-minute structure bars",
    };
  }

  const last = lastCompletedBar(bars5m);
  const prior = completed[completed.length - 2]!;
  if (!last) {
    return {
      pass: false,
      waiting: true,
      reason: "Waiting for completed 5-minute close",
    };
  }

  if (side === "LONG") {
    const breakout = last.close > prior.high;
    const higherLow = last.low >= prior.low && last.close > prior.close;
    if (breakout || higherLow) {
      return {
        pass: true,
        waiting: false,
        reason: breakout
          ? `Structure PASS: 5m close ${last.close.toFixed(2)} > prior high ${prior.high.toFixed(2)}`
          : `Structure PASS: higher-low hold with close ${last.close.toFixed(2)}`,
      };
    }
    return {
      pass: false,
      waiting: true,
      reason: "Waiting for bullish structure (breakout close or higher-low hold)",
    };
  }

  const breakdown = last.close < prior.low;
  const lowerHigh = last.high <= prior.high && last.close < prior.close;
  if (breakdown || lowerHigh) {
    return {
      pass: true,
      waiting: false,
      reason: breakdown
        ? `Structure PASS: 5m close ${last.close.toFixed(2)} < prior low ${prior.low.toFixed(2)}`
        : `Structure PASS: lower-high hold with close ${last.close.toFixed(2)}`,
    };
  }
  return {
    pass: false,
    waiting: true,
    reason: "Waiting for bearish structure (breakdown close or lower-high hold)",
  };
}
