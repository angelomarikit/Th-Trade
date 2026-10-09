import type { Bar } from "@wulu/market-data";
import { runBacktest, type BacktestEngineInput } from "./engine.js";
import { computeEdgeMetrics, type EdgeMetrics } from "./metrics.js";
import type { BacktestTrade } from "./types.js";

export interface WalkForwardSplit {
  train: { start: number; end: number };
  validation: { start: number; end: number };
  outOfSample: { start: number; end: number };
}

export interface WalkForwardReport {
  splits: WalkForwardSplit[];
  train: EdgeMetrics;
  validation: EdgeMetrics;
  outOfSample: EdgeMetrics;
  /** Expectancy degradation train → OOS (negative = worse OOS) */
  expectancyDegradationR: number | null;
  winRateDegradation: number | null;
  note: string;
}

/**
 * Single contiguous split: 60% train / 20% validation / 20% OOS.
 * Do not optimize on full dataset and report the same data as proof.
 */
export function contiguousSplit(barCount: number): WalkForwardSplit {
  const trainEnd = Math.floor(barCount * 0.6);
  const valEnd = Math.floor(barCount * 0.8);
  return {
    train: { start: 0, end: trainEnd },
    validation: { start: trainEnd, end: valEnd },
    outOfSample: { start: valEnd, end: barCount },
  };
}

export function rollingSplits(
  barCount: number,
  trainSize: number,
  valSize: number,
  oosSize: number,
  step: number,
): WalkForwardSplit[] {
  const splits: WalkForwardSplit[] = [];
  let start = 0;
  while (start + trainSize + valSize + oosSize <= barCount) {
    const trainEnd = start + trainSize;
    const valEnd = trainEnd + valSize;
    const oosEnd = valEnd + oosSize;
    splits.push({
      train: { start, end: trainEnd },
      validation: { start: trainEnd, end: valEnd },
      outOfSample: { start: valEnd, end: oosEnd },
    });
    start += step;
  }
  return splits;
}

export function runWalkForward(
  input: Omit<BacktestEngineInput, "barStart" | "barEnd"> & { bars: Bar[] },
  mode: "contiguous" | "rolling" = "contiguous",
): WalkForwardReport {
  const splits =
    mode === "rolling"
      ? rollingSplits(input.bars.length, 80, 30, 30, 40)
      : [contiguousSplit(input.bars.length)];

  let trainTrades: BacktestTrade[] = [];
  let valTrades: BacktestTrade[] = [];
  let oosTrades: BacktestTrade[] = [];

  for (const s of splits) {
    trainTrades = trainTrades.concat(
      runBacktest({ ...input, barStart: s.train.start, barEnd: s.train.end }).trades,
    );
    valTrades = valTrades.concat(
      runBacktest({ ...input, barStart: s.validation.start, barEnd: s.validation.end }).trades,
    );
    oosTrades = oosTrades.concat(
      runBacktest({ ...input, barStart: s.outOfSample.start, barEnd: s.outOfSample.end }).trades,
    );
  }

  const train = computeEdgeMetrics(trainTrades);
  const validation = computeEdgeMetrics(valTrades);
  const outOfSample = computeEdgeMetrics(oosTrades);

  return {
    splits,
    train,
    validation,
    outOfSample,
    expectancyDegradationR:
      train.expectancyR != null && outOfSample.expectancyR != null
        ? outOfSample.expectancyR - train.expectancyR
        : null,
    winRateDegradation:
      train.winRate != null && outOfSample.winRate != null
        ? outOfSample.winRate - train.winRate
        : null,
    note: "In-sample metrics are not proof of live edge. Prefer out-of-sample / walk-forward.",
  };
}
