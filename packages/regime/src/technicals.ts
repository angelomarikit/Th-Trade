import type { Bar } from "@wulu/market-data";
import { sessionVwap } from "@wulu/market-data";

/** Use only completed bars to prevent look-ahead. */
export function completedBars(bars: Bar[]): Bar[] {
  return bars.filter((b) => b.completed);
}

export function sma(values: number[], period: number): number | null {
  if (values.length < period) return null;
  const slice = values.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

export function closes(bars: Bar[]): number[] {
  return bars.map((b) => b.close);
}

/**
 * Slope of close over `lookback` completed bars as % of first close.
 * Positive = rising.
 */
export function trendSlopePct(bars: Bar[], lookback = 10): number | null {
  const c = completedBars(bars);
  if (c.length < lookback) return null;
  const slice = c.slice(-lookback);
  const first = slice[0]!.close;
  const last = slice[slice.length - 1]!.close;
  if (first === 0) return null;
  return ((last - first) / first) * 100;
}

/** Wilder-style ATR as % of last close (completed bars only). */
export function atrPct(bars: Bar[], period = 14): number | null {
  const c = completedBars(bars);
  if (c.length < period + 1) return null;

  const trs: number[] = [];
  for (let i = 1; i < c.length; i++) {
    const cur = c[i]!;
    const prev = c[i - 1]!;
    const tr = Math.max(
      cur.high - cur.low,
      Math.abs(cur.high - prev.close),
      Math.abs(cur.low - prev.close),
    );
    trs.push(tr);
  }
  const slice = trs.slice(-period);
  const atr = slice.reduce((a, b) => a + b, 0) / period;
  const lastClose = c[c.length - 1]!.close;
  if (lastClose <= 0) return null;
  return (atr / lastClose) * 100;
}

export function priceVsVwap(
  bars: Bar[],
  lastPrice: number,
): "ABOVE" | "BELOW" | "AT" | "UNKNOWN" {
  const vwap = sessionVwap(completedBars(bars).length ? completedBars(bars) : bars);
  if (vwap == null) return "UNKNOWN";
  if (lastPrice > vwap * 1.001) return "ABOVE";
  if (lastPrice < vwap * 0.999) return "BELOW";
  return "AT";
}

/** Relative strength: symbol return / benchmark return over lookback. */
export function relativeStrengthRatio(
  symbolBars: Bar[],
  benchmarkBars: Bar[],
  lookback = 10,
): number | null {
  const a = completedBars(symbolBars);
  const b = completedBars(benchmarkBars);
  if (a.length < lookback || b.length < lookback) return null;
  const a0 = a[a.length - lookback]!.close;
  const a1 = a[a.length - 1]!.close;
  const b0 = b[b.length - lookback]!.close;
  const b1 = b[b.length - 1]!.close;
  if (a0 <= 0 || b0 <= 0) return null;
  const symRet = (a1 - a0) / a0;
  const benRet = (b1 - b0) / b0;
  // RS as difference in returns (percentage points) — clearer than ratio near zero
  return (symRet - benRet) * 100;
}

export function classifyTrend(slopePct: number | null): "BULLISH" | "BEARISH" | "RANGE" {
  if (slopePct == null) return "RANGE";
  if (slopePct >= 0.35) return "BULLISH";
  if (slopePct <= -0.35) return "BEARISH";
  return "RANGE";
}

export function classifyVolatility(atrPercent: number | null): "HIGH" | "NORMAL" | "LOW" {
  if (atrPercent == null) return "NORMAL";
  if (atrPercent >= 1.2) return "HIGH";
  if (atrPercent <= 0.35) return "LOW";
  return "NORMAL";
}
