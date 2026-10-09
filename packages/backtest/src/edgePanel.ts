import type { EdgeMetrics } from "./metrics.js";
import type { WalkForwardReport } from "./walkForward.js";

export const HISTORICAL_EDGE_DISCLAIMER =
  "Historical win rate is NOT the probability that the current trade will win. Past setups ≠ future outcome.";

export interface HistoricalEdgePanel {
  strategyId: string;
  strategyName: string;
  symbol: string;
  regimeFilter: string | null;
  sampleSize: number;
  winRatePct: number | null;
  averageWinnerR: number | null;
  averageLoserR: number | null;
  expectancyR: number | null;
  profitFactor: number | null;
  maxDrawdownR: number | null;
  bestRegime: string | null;
  catalystSubset: {
    withCatalystExpectancyR: number | null;
    withoutCatalystExpectancyR: number | null;
    withCatalystSample: number;
    withoutCatalystSample: number;
  };
  walkForward?: {
    trainExpectancyR: number | null;
    validationExpectancyR: number | null;
    oosExpectancyR: number | null;
    expectancyDegradationR: number | null;
  };
  disclaimer: string;
  collapsedSummary: string;
}

export function buildHistoricalEdgePanel(input: {
  strategyId: string;
  strategyName: string;
  symbol: string;
  metrics: EdgeMetrics;
  regimeFilter?: string | null;
  walkForward?: WalkForwardReport | null;
}): HistoricalEdgePanel {
  const m = input.metrics;
  const bestRegime = pickBestRegime(m);

  const panel: HistoricalEdgePanel = {
    strategyId: input.strategyId,
    strategyName: input.strategyName,
    symbol: input.symbol,
    regimeFilter: input.regimeFilter ?? null,
    sampleSize: m.sampleSize,
    winRatePct: m.winRate != null ? m.winRate * 100 : null,
    averageWinnerR: m.averageWinnerR,
    averageLoserR: m.averageLoserR,
    expectancyR: m.expectancyR,
    profitFactor: m.profitFactor,
    maxDrawdownR: m.maxDrawdownR,
    bestRegime,
    catalystSubset: {
      withCatalystExpectancyR: m.withCatalyst.expectancyR,
      withoutCatalystExpectancyR: m.withoutCatalyst.expectancyR,
      withCatalystSample: m.withCatalyst.sampleSize,
      withoutCatalystSample: m.withoutCatalyst.sampleSize,
    },
    disclaimer: HISTORICAL_EDGE_DISCLAIMER,
    collapsedSummary: "",
  };

  if (input.walkForward) {
    panel.walkForward = {
      trainExpectancyR: input.walkForward.train.expectancyR,
      validationExpectancyR: input.walkForward.validation.expectancyR,
      oosExpectancyR: input.walkForward.outOfSample.expectancyR,
      expectancyDegradationR: input.walkForward.expectancyDegradationR,
    };
  }

  panel.collapsedSummary = formatCollapsed(panel);
  return panel;
}

function pickBestRegime(m: EdgeMetrics): string | null {
  let best: string | null = null;
  let bestExp = Number.NEGATIVE_INFINITY;
  for (const [k, v] of Object.entries(m.byRegime)) {
    if (v.sampleSize < 3 || v.expectancyR == null) continue;
    if (v.expectancyR > bestExp) {
      bestExp = v.expectancyR;
      best = k;
    }
  }
  return best;
}

function formatCollapsed(p: HistoricalEdgePanel): string {
  const wr = p.winRatePct != null ? `${p.winRatePct.toFixed(1)}%` : "—";
  const exp = p.expectancyR != null ? `${p.expectancyR >= 0 ? "+" : ""}${p.expectancyR.toFixed(2)}R` : "—";
  return `${p.strategyName} | n=${p.sampleSize} | WR ${wr} | Exp ${exp}`;
}

export function formatHistoricalEdgeText(panel: HistoricalEdgePanel): string {
  return [
    "HISTORICAL EDGE",
    `Strategy: ${panel.strategyName}`,
    `Historical sample: ${panel.sampleSize} setups`,
    `Win rate: ${panel.winRatePct != null ? panel.winRatePct.toFixed(1) + "%" : "—"}`,
    `Average winner: ${fmtR(panel.averageWinnerR)}`,
    `Average loser: ${fmtR(panel.averageLoserR)}`,
    `Expectancy: ${fmtR(panel.expectancyR)}`,
    `Profit factor: ${panel.profitFactor != null ? panel.profitFactor.toFixed(2) : "—"}`,
    `Maximum drawdown: ${fmtR(panel.maxDrawdownR)}`,
    `Best regime: ${panel.bestRegime ?? "—"}`,
    `Catalyst subset: with=${fmtR(panel.catalystSubset.withCatalystExpectancyR)} (n=${panel.catalystSubset.withCatalystSample}); without=${fmtR(panel.catalystSubset.withoutCatalystExpectancyR)} (n=${panel.catalystSubset.withoutCatalystSample})`,
    panel.disclaimer,
  ].join("\n");
}

function fmtR(n: number | null): string {
  if (n == null) return "—";
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}R`;
}
