import type { Bar, MarketSnapshot, Quote } from "@wulu/market-data";

export type FixtureTrend = "bullish" | "bearish" | "range";

/** Synthetic completed bars for offline regime tests (no look-ahead). */
export function makeIndexSnapshot(input: {
  symbol: string;
  trend: FixtureTrend;
  basePrice: number;
  now?: Date;
  barCount?: number;
}): MarketSnapshot {
  const now = input.now ?? new Date("2026-10-09T15:00:00Z");
  const count = input.barCount ?? 40;
  const bars5m = buildTrendBars(input.symbol, "5Min", input.trend, input.basePrice, now, count);
  const bars1m = buildTrendBars(input.symbol, "1Min", input.trend, input.basePrice, now, count * 2);
  const last = bars5m.at(-1)!;
  const quote: Quote = {
    symbol: input.symbol,
    bid: last.close - 0.01,
    ask: last.close + 0.01,
    timestamp: now,
  };
  return {
    symbol: input.symbol,
    lastPrice: last.close,
    quote,
    bars1m,
    bars5m,
    receivedAt: now,
    marketTimestamp: now,
  };
}

function buildTrendBars(
  symbol: string,
  timeframe: Bar["timeframe"],
  trend: FixtureTrend,
  base: number,
  now: Date,
  count: number,
): Bar[] {
  const tfMs = timeframe === "5Min" ? 300_000 : 60_000;
  const bars: Bar[] = [];
  for (let i = count; i >= 1; i--) {
    const progress = (count - i) / Math.max(1, count - 1);
    let close = base;
    if (trend === "bullish") close = base * (1 + 0.02 * progress);
    else if (trend === "bearish") close = base * (1 - 0.02 * progress);
    else close = base * (1 + 0.001 * Math.sin(progress * Math.PI * 4));

    const open = close * (trend === "bearish" ? 1.0005 : 0.9995);
    const high = Math.max(open, close) * 1.001;
    const low = Math.min(open, close) * 0.999;
    bars.push({
      symbol,
      timeframe,
      timestamp: new Date(now.getTime() - i * tfMs),
      open,
      high,
      low,
      close,
      volume: 1_000_000 + i * 1000,
      vwap: (high + low + close) / 3,
      completed: true,
    });
  }
  return bars;
}
