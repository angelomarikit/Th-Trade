import type { TradeSide } from "@wulu/domain";
import type { Bar } from "@wulu/market-data";
import { listStrategies } from "./registry.js";
import type { StrategySignal } from "./types.js";

export interface LiveMatchResult {
  signal: StrategySignal;
  strategyName: string;
  strategyVersion: string;
  family: string;
}

/**
 * Match live bars against the SAME strategy definitions used in backtests.
 * Evaluates at the last completed bar only.
 */
export function matchStrategiesOnBars(input: {
  symbol: string;
  bars: Bar[];
  side?: TradeSide;
  regimePrimary?: string;
  hasCatalyst?: boolean;
  enabledFamilies?: Partial<Record<string, boolean>>;
}): LiveMatchResult[] {
  const completedIdx: number[] = [];
  input.bars.forEach((b, i) => {
    if (b.completed) completedIdx.push(i);
  });
  if (completedIdx.length === 0) return [];
  const barIndex = completedIdx[completedIdx.length - 1]!;

  const matches: LiveMatchResult[] = [];
  for (const strategy of listStrategies()) {
    if (input.side && strategy.side !== "BOTH" && strategy.side !== input.side) continue;
    if (input.enabledFamilies && strategy.family !== "other") {
      const allowed = input.enabledFamilies[strategy.family];
      if (allowed === false) continue;
    }
    const signal = strategy.detect({
      symbol: input.symbol,
      bars: input.bars,
      barIndex,
      regimePrimary: input.regimePrimary,
      hasCatalyst: input.hasCatalyst,
    });
    if (signal) {
      matches.push({
        signal,
        strategyName: strategy.name,
        strategyVersion: strategy.version,
        family: strategy.family,
      });
    }
  }
  return matches;
}
