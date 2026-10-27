import type { Bar } from "@wulu/market-data";
import type { MarketRegimeLabel } from "./types.js";
import { adx, atrAbs, completed, closes, emaAt, lastEma } from "./indicators.js";

export interface RegimeSignals {
  bullish: boolean;
  sideways: boolean;
  bearish: boolean;
  highVolatility: boolean;
  uncertain: boolean;
  dataUnavailable: boolean;
  reasons: string[];
}

export function spyRegimeSignals(spyDaily: Bar[]): RegimeSignals {
  const c = completed(spyDaily);
  const reasons: string[] = [];
  if (c.length < 210) {
    return {
      bullish: false,
      sideways: false,
      bearish: false,
      highVolatility: false,
      uncertain: false,
      dataUnavailable: true,
      reasons: ["SPY daily history insufficient for 200 EMA regime"],
    };
  }
  const cl = closes(c);
  const last = cl[cl.length - 1]!;
  const ema200 = lastEma(cl, 200);
  const ema50 = lastEma(cl, 50);
  const ema20 = lastEma(cl, 20);
  if (ema200 == null || ema50 == null || ema20 == null) {
    return {
      bullish: false,
      sideways: false,
      bearish: false,
      highVolatility: false,
      uncertain: false,
      dataUnavailable: true,
      reasons: ["SPY EMA calculation failed"],
    };
  }

  const ema50Series = cl.map((_, i) => emaAt(cl, 50, i)).filter((v): v is number => v != null);
  const ema50Rising10 =
    ema50Series.length >= 11 &&
    ema50Series[ema50Series.length - 1]! > ema50Series[ema50Series.length - 11]!;

  const bullish =
    last > ema200 && ema50 > ema200 && ema50Rising10;
  if (bullish) reasons.push("SPY above 200 EMA, 50>200 EMA, 50 EMA rising 10 sessions");

  const adx14 = adx(c, 14);
  const ema20Series = cl.map((_, i) => emaAt(cl, 20, i)).filter((v): v is number => v != null);
  const ema20Flat =
    ema20Series.length >= 11 &&
    Math.abs(ema20Series[ema20Series.length - 1]! - ema20Series[ema20Series.length - 11]!) /
      ema20Series[ema20Series.length - 11]! <
      0.01;
  const window20 = c.slice(-20);
  const rangeHigh = Math.max(...window20.map((b) => b.high));
  const rangeLow = Math.min(...window20.map((b) => b.low));
  const inRange = last >= rangeLow && last <= rangeHigh;
  const sideways = adx14 != null && adx14 < 20 && ema20Flat && inRange;
  if (sideways) reasons.push("SPY ADX<20, flat 20 EMA, price in 20-day range");

  const bearish = last < ema200 && ema50 < ema200;
  if (bearish) reasons.push("SPY below 200 EMA and 50 EMA below 200 EMA");

  const atrNow = atrAbs(c, 14);
  const atrHist: number[] = [];
  for (let i = 30; i < c.length; i++) {
    const a = atrAbs(c.slice(0, i + 1), 14);
    if (a != null) atrHist.push(a);
  }
  const atrMedian =
    atrHist.length > 0
      ? [...atrHist].sort((a, b) => a - b)[Math.floor(atrHist.length / 2)]!
      : null;
  const highVolatility =
    atrNow != null &&
    atrMedian != null &&
    atrNow > atrMedian * 1.35 &&
    last > 0 &&
    atrNow / last > 0.015;
  if (highVolatility) reasons.push("SPY ATR materially elevated vs trailing median");

  const flags = [bullish, sideways, bearish].filter(Boolean).length;
  const uncertain = flags > 1 || (flags === 0 && !highVolatility);
  if (uncertain && !highVolatility) reasons.push("Regime signals conflict or weak");

  return {
    bullish,
    sideways,
    bearish,
    highVolatility,
    uncertain,
    dataUnavailable: false,
    reasons,
  };
}

/** Deterministic priority: data unavailable → high vol → bearish → bullish → sideways → uncertain */
export function resolveMarketRegime(signals: RegimeSignals): MarketRegimeLabel {
  if (signals.dataUnavailable) return "DATA_UNAVAILABLE";
  if (signals.highVolatility) return "HIGH_VOLATILITY";
  if (signals.bearish) return "BEARISH";
  if (signals.bullish) return "BULLISH";
  if (signals.sideways) return "SIDEWAYS";
  return "UNCERTAIN";
}

export function strategyAllowedInRegime(
  strategy: string,
  regime: MarketRegimeLabel,
): boolean {
  if (regime === "DATA_UNAVAILABLE") return false;
  if (regime === "HIGH_VOLATILITY" || regime === "UNCERTAIN") {
    return strategy === "RSI_MEAN_REVERSION_DAILY" || strategy === "VWAP_RECLAIM_INTRADAY";
  }
  if (regime === "BEARISH") {
    return false;
  }
  if (regime === "SIDEWAYS") {
    return strategy === "RSI_MEAN_REVERSION_DAILY";
  }
  // BULLISH
  return (
    strategy === "EMA_PULLBACK_DAILY" ||
    strategy === "BREAKOUT_DAILY" ||
    strategy === "VWAP_RECLAIM_INTRADAY" ||
    strategy === "MTF_TREND" ||
    strategy === "OPENING_RANGE_BREAKOUT"
  );
}
