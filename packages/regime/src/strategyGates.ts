import type { RegimeSnapshot, StrategyFamilyGates } from "./labels.js";

/**
 * Soft strategy gating by regime — Phase D strategies must still pass global confirmation.
 * Do not blindly enable every strategy in every environment.
 */
export function strategyGatesForRegime(input: {
  trend: RegimeSnapshot["trend"];
  volatility: RegimeSnapshot["volatility"];
  riskTone: RegimeSnapshot["riskTone"];
}): StrategyFamilyGates {
  const { trend, volatility, riskTone } = input;
  const trending = trend === "BULLISH" || trend === "BEARISH";
  const riskOff = riskTone === "RISK_OFF";
  const highVol = volatility === "HIGH";

  return {
    openingRangeBreakout: trending && !riskOff,
    breakoutRetest: trending,
    vwapReclaim: trend !== "BEARISH" || riskTone === "RISK_ON",
    vwapRejection: trend !== "BULLISH" || riskTone === "RISK_OFF",
    momentumContinuation: trending && !highVol,
    failedBreakoutReversal: highVol || trend === "RANGE",
    meanReversion: trend === "RANGE" || volatility === "LOW",
  };
}
