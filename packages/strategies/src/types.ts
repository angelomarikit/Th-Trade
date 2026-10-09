import type { TradeSide } from "@wulu/domain";
import type { Bar } from "@wulu/market-data";

export type StrategyFamily =
  | "openingRangeBreakout"
  | "breakoutRetest"
  | "vwapReclaim"
  | "vwapRejection"
  | "momentumContinuation"
  | "failedBreakoutReversal"
  | "meanReversion"
  | "other";

export interface StrategyContext {
  symbol: string;
  /** Chronological bars; only bars with index <= barIndex may be used */
  bars: Bar[];
  /** Signal evaluation bar (must be completed) */
  barIndex: number;
  regimePrimary?: string;
  hasCatalyst?: boolean;
}

export interface StrategySignal {
  strategyId: string;
  side: TradeSide;
  /** Signal time = bar close time (no look-ahead) */
  signalBarIndex: number;
  trigger: number;
  entry: number;
  stop: number;
  target1: number;
  target2: number;
  reason: string;
}

export interface StrategyDefinition {
  id: string;
  name: string;
  version: string;
  family: StrategyFamily;
  side: TradeSide | "BOTH";
  description: string;
  /**
   * Detect signal using only bars[0..barIndex] (completed).
   * Must not read future bars.
   */
  detect: (ctx: StrategyContext) => StrategySignal | null;
}

export function sliceTo(ctx: StrategyContext): Bar[] {
  return ctx.bars.slice(0, ctx.barIndex + 1).filter((b) => b.completed);
}
