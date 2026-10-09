import type { Bar } from "@wulu/market-data";

/** Synthetic trending series that produces VWAP reclaim / momentum setups. */
export function makeBacktestBars(input?: {
  count?: number;
  base?: number;
  now?: Date;
  symbol?: string;
}): Bar[] {
  const count = input?.count ?? 200;
  const base = input?.base ?? 100;
  const now = input?.now ?? new Date("2026-10-08T20:00:00Z");
  const symbol = input?.symbol ?? "TEST";
  const bars: Bar[] = [];

  for (let i = count; i >= 1; i--) {
    const progress = (count - i) / count;
    // Dip then reclaim pattern mid-series + overall drift up
    const dip = Math.sin(progress * Math.PI * 6) * 1.2;
    const close = base + progress * 8 + dip;
    const open = close - 0.05;
    const high = Math.max(open, close) + 0.25;
    const low = Math.min(open, close) - 0.25;
    bars.push({
      symbol,
      timeframe: "5Min",
      timestamp: new Date(now.getTime() - i * 300_000),
      open,
      high,
      low,
      close,
      volume: 50_000 + Math.floor(progress * 80_000),
      vwap: (high + low + close) / 3,
      completed: true,
    });
  }
  return bars;
}
