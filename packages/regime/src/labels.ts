export const REGIME_LABELS = [
  "TRENDING_BULLISH",
  "TRENDING_BEARISH",
  "RANGE",
  "HIGH_VOLATILITY",
  "LOW_VOLATILITY",
  "RISK_ON",
  "RISK_OFF",
  "MIXED",
] as const;

export type RegimeLabel = (typeof REGIME_LABELS)[number];

export type MarketBias = "BULLISH" | "BEARISH" | "MIXED";

export type TrendDirection = "BULLISH" | "BEARISH" | "RANGE";
export type VolatilityBand = "HIGH" | "NORMAL" | "LOW";
export type RiskTone = "RISK_ON" | "RISK_OFF" | "MIXED";

/** Strategy families for Phase D gating (hooks only in Phase C). */
export interface StrategyFamilyGates {
  openingRangeBreakout: boolean;
  breakoutRetest: boolean;
  vwapReclaim: boolean;
  vwapRejection: boolean;
  momentumContinuation: boolean;
  failedBreakoutReversal: boolean;
  meanReversion: boolean;
}

export interface RegimeSnapshot {
  primary: RegimeLabel;
  bias: MarketBias;
  trend: TrendDirection;
  volatility: VolatilityBand;
  riskTone: RiskTone;
  labels: RegimeLabel[];
  reasons: string[];
  /** Index metrics used (completed bars only) */
  metrics: {
    spyVsVwap: "ABOVE" | "BELOW" | "AT" | "UNKNOWN";
    spyTrendSlopePct: number | null;
    qqqVsSpyRs: number | null;
    iwmVsSpyRs: number | null;
    atrPct: number | null;
    vixLevel: number | null;
  };
  strategyGates: StrategyFamilyGates;
  evaluatedAt: string;
}
