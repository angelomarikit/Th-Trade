import type { Bar } from "@wulu/market-data";

export interface SwingPoint {
  index: number;
  price: number;
  timestamp: string;
  kind: "HIGH" | "LOW";
}

export interface SwingStructure {
  swingHighs: SwingPoint[];
  swingLows: SwingPoint[];
  resistance: number | null;
  support: number | null;
  trend: "HH_HL" | "LH_LL" | "RANGE" | "UNKNOWN";
  consolidationHigh: number | null;
  consolidationLow: number | null;
}

/**
 * Fractal swing points on completed bars only (left/right lookback = 2).
 * No look-ahead: only uses bars[0..i] when classifying bar i.
 */
export function findSwingStructure(bars5m: Bar[], lookback = 2): SwingStructure {
  const completed = bars5m.filter((b) => b.completed);
  const swingHighs: SwingPoint[] = [];
  const swingLows: SwingPoint[] = [];

  for (let i = lookback; i < completed.length - lookback; i++) {
    const bar = completed[i]!;
    let isHigh = true;
    let isLow = true;
    for (let j = 1; j <= lookback; j++) {
      if (completed[i - j]!.high >= bar.high || completed[i + j]!.high > bar.high) isHigh = false;
      if (completed[i - j]!.low <= bar.low || completed[i + j]!.low < bar.low) isLow = false;
    }
    // Right side uses only bars that exist — for live last bars, require full right window
    if (isHigh) {
      swingHighs.push({
        index: i,
        price: bar.high,
        timestamp: bar.timestamp.toISOString(),
        kind: "HIGH",
      });
    }
    if (isLow) {
      swingLows.push({
        index: i,
        price: bar.low,
        timestamp: bar.timestamp.toISOString(),
        kind: "LOW",
      });
    }
  }

  const recentHighs = swingHighs.slice(-3);
  const recentLows = swingLows.slice(-3);
  const resistance = recentHighs.at(-1)?.price ?? completed.at(-2)?.high ?? null;
  const support = recentLows.at(-1)?.price ?? completed.at(-2)?.low ?? null;

  let trend: SwingStructure["trend"] = "UNKNOWN";
  if (recentHighs.length >= 2 && recentLows.length >= 2) {
    const hh = recentHighs[recentHighs.length - 1]!.price > recentHighs[recentHighs.length - 2]!.price;
    const hl = recentLows[recentLows.length - 1]!.price > recentLows[recentLows.length - 2]!.price;
    const lh = recentHighs[recentHighs.length - 1]!.price < recentHighs[recentHighs.length - 2]!.price;
    const ll = recentLows[recentLows.length - 1]!.price < recentLows[recentLows.length - 2]!.price;
    if (hh && hl) trend = "HH_HL";
    else if (lh && ll) trend = "LH_LL";
    else trend = "RANGE";
  } else if (completed.length >= 6) {
    trend = "RANGE";
  }

  const window = completed.slice(-12);
  const consolidationHigh = window.length
    ? Math.max(...window.map((b) => b.high))
    : null;
  const consolidationLow = window.length
    ? Math.min(...window.map((b) => b.low))
    : null;

  return {
    swingHighs,
    swingLows,
    resistance,
    support,
    trend,
    consolidationHigh,
    consolidationLow,
  };
}
