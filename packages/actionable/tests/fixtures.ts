import type { Bar } from "@wulu/market-data";

export function dailyBar(
  i: number,
  o: number,
  h: number,
  l: number,
  c: number,
  v = 1_000_000,
): Bar {
  const d = new Date(Date.UTC(2024, 0, 2 + i, 21, 0, 0));
  return {
    symbol: "TEST",
    timeframe: "1Day",
    timestamp: d,
    open: o,
    high: h,
    low: l,
    close: c,
    volume: v,
    completed: true,
  };
}

/** Uptrend with EMA stack-friendly closes (220 bars). */
export function bullishDailyStack(symbol = "TEST"): Bar[] {
  const bars: Bar[] = [];
  let px = 100;
  for (let i = 0; i < 220; i++) {
    px += 0.15 + (i > 200 ? 0.05 : 0);
    bars.push(dailyBar(i, px - 0.2, px + 0.3, px - 0.4, px));
  }
  return bars.map((b) => ({ ...b, symbol }));
}

export function flatSpyDaily(): Bar[] {
  return bullishDailyStack("SPY");
}
