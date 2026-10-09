import type { Bar, MarketSnapshot } from "@wulu/market-data";
import type {
  MarketBias,
  RegimeLabel,
  RegimeSnapshot,
  RiskTone,
  TrendDirection,
  VolatilityBand,
} from "./labels.js";
import { strategyGatesForRegime } from "./strategyGates.js";
import {
  atrPct,
  classifyTrend,
  classifyVolatility,
  priceVsVwap,
  relativeStrengthRatio,
  trendSlopePct,
} from "./technicals.js";

export interface RegimeEngineInput {
  spy: MarketSnapshot;
  qqq?: MarketSnapshot | null;
  iwm?: MarketSnapshot | null;
  /** Optional VIX last price when licensed data is available */
  vixLevel?: number | null;
  now?: Date;
}

/**
 * Deterministic market regime from verified index snapshots.
 * Only completed bars enter trend/ATR/RS math (no look-ahead).
 */
export function evaluateMarketRegime(input: RegimeEngineInput): RegimeSnapshot {
  const now = input.now ?? new Date();
  const spyBars = preferBars(input.spy);
  const qqqBars = input.qqq ? preferBars(input.qqq) : [];
  const iwmBars = input.iwm ? preferBars(input.iwm) : [];

  const slope = trendSlopePct(spyBars, 10);
  const trend = classifyTrend(slope);
  const atr = atrPct(spyBars, 14);
  const volatility = classifyVolatility(atr);
  const spyVsVwap = priceVsVwap(spyBars, input.spy.lastPrice);

  const qqqRs =
    qqqBars.length > 0 ? relativeStrengthRatio(qqqBars, spyBars, 10) : null;
  const iwmRs =
    iwmBars.length > 0 ? relativeStrengthRatio(iwmBars, spyBars, 10) : null;

  const riskTone = classifyRiskTone({
    trend,
    spyVsVwap,
    qqqRs,
    iwmRs,
    vixLevel: input.vixLevel ?? null,
  });

  const labels = composeLabels(trend, volatility, riskTone);
  const primary = pickPrimary(labels, trend, volatility, riskTone);
  const bias = biasFrom(trend, riskTone);
  const reasons = buildReasons({
    trend,
    slope,
    volatility,
    atr,
    spyVsVwap,
    riskTone,
    qqqRs,
    iwmRs,
    vixLevel: input.vixLevel ?? null,
    primary,
  });

  return {
    primary,
    bias,
    trend,
    volatility,
    riskTone,
    labels,
    reasons,
    metrics: {
      spyVsVwap,
      spyTrendSlopePct: slope,
      qqqVsSpyRs: qqqRs,
      iwmVsSpyRs: iwmRs,
      atrPct: atr,
      vixLevel: input.vixLevel ?? null,
    },
    strategyGates: strategyGatesForRegime({ trend, volatility, riskTone }),
    evaluatedAt: now.toISOString(),
  };
}

function preferBars(snapshot: MarketSnapshot): Bar[] {
  return snapshot.bars5m.length >= 20 ? snapshot.bars5m : snapshot.bars1m;
}

function classifyRiskTone(input: {
  trend: TrendDirection;
  spyVsVwap: "ABOVE" | "BELOW" | "AT" | "UNKNOWN";
  qqqRs: number | null;
  iwmRs: number | null;
  vixLevel: number | null;
}): RiskTone {
  let score = 0;
  if (input.trend === "BULLISH") score += 1;
  if (input.trend === "BEARISH") score -= 1;
  if (input.spyVsVwap === "ABOVE") score += 1;
  if (input.spyVsVwap === "BELOW") score -= 1;
  if (input.qqqRs != null && input.qqqRs > 0.15) score += 1;
  if (input.qqqRs != null && input.qqqRs < -0.15) score -= 1;
  if (input.iwmRs != null && input.iwmRs > 0.15) score += 0.5;
  if (input.iwmRs != null && input.iwmRs < -0.15) score -= 0.5;
  if (input.vixLevel != null && input.vixLevel >= 25) score -= 1;
  if (input.vixLevel != null && input.vixLevel <= 14) score += 0.5;

  if (score >= 1.5) return "RISK_ON";
  if (score <= -1.5) return "RISK_OFF";
  return "MIXED";
}

function composeLabels(
  trend: TrendDirection,
  volatility: VolatilityBand,
  riskTone: RiskTone,
): RegimeLabel[] {
  const labels: RegimeLabel[] = [];
  if (trend === "BULLISH") labels.push("TRENDING_BULLISH");
  if (trend === "BEARISH") labels.push("TRENDING_BEARISH");
  if (trend === "RANGE") labels.push("RANGE");
  if (volatility === "HIGH") labels.push("HIGH_VOLATILITY");
  if (volatility === "LOW") labels.push("LOW_VOLATILITY");
  if (riskTone === "RISK_ON") labels.push("RISK_ON");
  if (riskTone === "RISK_OFF") labels.push("RISK_OFF");
  if (riskTone === "MIXED" && trend === "RANGE") labels.push("MIXED");
  if (labels.length === 0) labels.push("MIXED");
  return [...new Set(labels)];
}

function pickPrimary(
  labels: RegimeLabel[],
  trend: TrendDirection,
  volatility: VolatilityBand,
  riskTone: RiskTone,
): RegimeLabel {
  if (volatility === "HIGH" && trend === "RANGE") return "HIGH_VOLATILITY";
  if (trend === "BULLISH") return "TRENDING_BULLISH";
  if (trend === "BEARISH") return "TRENDING_BEARISH";
  if (riskTone === "RISK_ON") return "RISK_ON";
  if (riskTone === "RISK_OFF") return "RISK_OFF";
  if (volatility === "LOW") return "LOW_VOLATILITY";
  if (labels.includes("RANGE")) return "RANGE";
  return "MIXED";
}

function biasFrom(trend: TrendDirection, riskTone: RiskTone): MarketBias {
  if (trend === "BULLISH" || riskTone === "RISK_ON") return "BULLISH";
  if (trend === "BEARISH" || riskTone === "RISK_OFF") return "BEARISH";
  return "MIXED";
}

function buildReasons(input: {
  trend: TrendDirection;
  slope: number | null;
  volatility: VolatilityBand;
  atr: number | null;
  spyVsVwap: string;
  riskTone: RiskTone;
  qqqRs: number | null;
  iwmRs: number | null;
  vixLevel: number | null;
  primary: RegimeLabel;
}): string[] {
  const reasons = [
    `Primary regime ${input.primary}`,
    `SPY trend ${input.trend}` +
      (input.slope != null ? ` (slope ${input.slope.toFixed(2)}%)` : ""),
    `SPY vs VWAP: ${input.spyVsVwap}`,
    `Volatility ${input.volatility}` +
      (input.atr != null ? ` (ATR ${input.atr.toFixed(2)}%)` : ""),
    `Risk tone ${input.riskTone}`,
  ];
  if (input.qqqRs != null) {
    reasons.push(`QQQ vs SPY RS ${input.qqqRs >= 0 ? "+" : ""}${input.qqqRs.toFixed(2)} pts`);
  }
  if (input.iwmRs != null) {
    reasons.push(`IWM vs SPY RS ${input.iwmRs >= 0 ? "+" : ""}${input.iwmRs.toFixed(2)} pts`);
  }
  if (input.vixLevel != null) {
    reasons.push(`VIX ${input.vixLevel.toFixed(2)}`);
  } else {
    reasons.push("VIX not available on this data plan — omitted");
  }
  return reasons;
}
