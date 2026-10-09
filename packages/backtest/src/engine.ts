import type { Bar } from "@wulu/market-data";
import { getStrategy, type StrategySignal } from "@wulu/strategies";

import {
  adjustEntryLong,
  adjustEntryShort,
  adjustExitLong,
  adjustExitShort,
  DEFAULT_COST_MODEL,
  type CostModel,
} from "./costs.js";
import type { BacktestRunResult, BacktestTrade } from "./types.js";

export const BACKTEST_SCHEMA_VERSION = "1.0.0";

export interface BacktestEngineInput {
  strategyId: string;
  symbol: string;
  bars: Bar[];
  costs?: CostModel;
  /** Max bars after entry before timeout exit */
  maxHoldBars?: number;
  regimePrimary?: string;
  hasCatalyst?: boolean;
  /** Optional: only evaluate signal bars in [start, end) */
  barStart?: number;
  barEnd?: number;
}

/**
 * Event-driven backtest using the SAME StrategyDefinition as live matching.
 * Signals use only bars <= i. Entry at next bar open + costs. No look-ahead.
 */
export function runBacktest(input: BacktestEngineInput): BacktestRunResult {
  const strategy = getStrategy(input.strategyId);
  if (!strategy) {
    throw new Error(`Unknown strategy: ${input.strategyId}`);
  }
  const costs = input.costs ?? DEFAULT_COST_MODEL;
  const maxHold = input.maxHoldBars ?? 24;
  const bars = input.bars;
  const start = input.barStart ?? 0;
  const end = input.barEnd ?? bars.length;

  const trades: BacktestTrade[] = [];
  let i = Math.max(start, 1);

  while (i < end - 1) {
    const bar = bars[i]!;
    if (!bar.completed) {
      i += 1;
      continue;
    }

    const detected = strategy.detect({
      symbol: input.symbol,
      bars,
      barIndex: i,
      regimePrimary: input.regimePrimary,
      hasCatalyst: input.hasCatalyst,
    });

    if (!detected) {
      i += 1;
      continue;
    }

    const trade = simulateTrade({
      bars,
      signal: detected,
      symbol: input.symbol,
      signalIndex: i,
      costs,
      maxHold,
      regimePrimary: input.regimePrimary,
      hasCatalyst: input.hasCatalyst,
      hardEnd: end,
    });


    if (trade) {
      trades.push(trade);
      // Skip to exit to avoid overlapping positions in Phase D simplicity
      i = trade.exitBarIndex + 1;
    } else {
      i += 1;
    }
  }

  return {
    strategyId: input.strategyId,
    symbol: input.symbol,
    trades,
    schemaVersion: BACKTEST_SCHEMA_VERSION,
  };
}

function simulateTrade(input: {
  bars: Bar[];
  signal: StrategySignal;
  symbol: string;
  signalIndex: number;
  costs: CostModel;
  maxHold: number;
  regimePrimary?: string;
  hasCatalyst?: boolean;
  hardEnd: number;
}): BacktestTrade | null {
  const entryIndex = input.signalIndex + 1;
  if (entryIndex >= input.hardEnd) return null;
  const entryBar = input.bars[entryIndex]!;
  if (!entryBar) return null;

  const rawEntry = entryBar.open;
  const entryPrice =
    input.signal.side === "LONG"
      ? adjustEntryLong(rawEntry, input.costs)
      : adjustEntryShort(rawEntry, input.costs);

  const stop = input.signal.stop;
  const target1 = input.signal.target1;
  const risk = Math.abs(entryPrice - stop);
  if (risk <= 0) return null;

  let mfe = 0;
  let mae = 0;
  const lastIndex = Math.min(entryIndex + input.maxHold, input.hardEnd - 1);

  for (let j = entryIndex; j <= lastIndex; j++) {
    const b = input.bars[j]!;
    if (input.signal.side === "LONG") {
      const fav = (b.high - entryPrice) / risk;
      const adv = (entryPrice - b.low) / risk;
      mfe = Math.max(mfe, fav);
      mae = Math.max(mae, adv);
      if (b.low <= stop) {
        const exit = adjustExitLong(stop, input.costs);
        return finish(input, entryIndex, j, entryPrice, exit, stop, target1, risk, "LOSS", mfe, mae);
      }
      if (b.high >= target1) {
        const exit = adjustExitLong(target1, input.costs);
        return finish(input, entryIndex, j, entryPrice, exit, stop, target1, risk, "WIN", mfe, mae);
      }
    } else {
      const fav = (entryPrice - b.low) / risk;
      const adv = (b.high - entryPrice) / risk;
      mfe = Math.max(mfe, fav);
      mae = Math.max(mae, adv);
      if (b.high >= stop) {
        const exit = adjustExitShort(stop, input.costs);
        return finish(input, entryIndex, j, entryPrice, exit, stop, target1, risk, "LOSS", mfe, mae);
      }
      if (b.low <= target1) {
        const exit = adjustExitShort(target1, input.costs);
        return finish(input, entryIndex, j, entryPrice, exit, stop, target1, risk, "WIN", mfe, mae);
      }
    }
  }

  const timeoutBar = input.bars[lastIndex]!;
  const rawExit = timeoutBar.close;
  const exit =
    input.signal.side === "LONG"
      ? adjustExitLong(rawExit, input.costs)
      : adjustExitShort(rawExit, input.costs);
  const r =
    input.signal.side === "LONG"
      ? (exit - entryPrice) / risk
      : (entryPrice - exit) / risk;
  return finish(
    input,
    entryIndex,
    lastIndex,
    entryPrice,
    exit,
    stop,
    target1,
    risk,
    r >= 0 ? "WIN" : "LOSS",
    mfe,
    mae,
    "TIMEOUT",
  );
}

function finish(
  input: {
    signal: StrategySignal;
    symbol: string;
    signalIndex: number;
    regimePrimary?: string;
    hasCatalyst?: boolean;
    bars: Bar[];
  },
  entryIndex: number,
  exitIndex: number,
  entryPrice: number,
  exitPrice: number,
  stop: number,
  target1: number,
  risk: number,
  outcome: "WIN" | "LOSS" | "TIMEOUT",
  mfe: number,
  mae: number,
  forcedOutcome?: "TIMEOUT",
): BacktestTrade {
  const r =
    input.signal.side === "LONG"
      ? (exitPrice - entryPrice) / risk
      : (entryPrice - exitPrice) / risk;
  return {
    strategyId: input.signal.strategyId,
    symbol: input.symbol,
    side: input.signal.side,
    signalBarIndex: input.signalIndex,
    entryBarIndex: entryIndex,
    exitBarIndex: exitIndex,
    entryPrice,
    exitPrice,
    stop,
    target1,
    rMultiple: r,
    outcome: forcedOutcome ?? outcome,
    regimePrimary: input.regimePrimary,
    hasCatalyst: input.hasCatalyst,
    entryHourUtc: input.bars[entryIndex]!.timestamp.getUTCHours(),
    mfeR: mfe,
    maeR: mae,
  };
}
