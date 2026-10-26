import { describe, expect, it } from "vitest";
import type { Bar } from "@wulu/market-data";
import { resolveHtfFromSnapshot, trendFromCompletedBars } from "../src/techniques/bars.js";

function bar(tf: Bar["timeframe"], i: number, close: number): Bar {
  return {
    symbol: "TEST",
    timeframe: tf,
    timestamp: new Date(Date.UTC(2026, 9, 27, 14, i)),
    open: close - 0.1,
    high: close + 0.2,
    low: close - 0.2,
    close,
    volume: 1_000_000,
    completed: true,
  };
}

describe("native HTF bars", () => {
  it("prefers native 1h/15m over 5m aggregate", () => {
    const bars5m = Array.from({ length: 24 }, (_, i) => bar("5Min", i, 100 - i * 0.05));
    const bars15m = [bar("15Min", 0, 100), bar("15Min", 1, 101), bar("15Min", 2, 102), bar("15Min", 3, 103)];
    const bars1h = [bar("1Hour", 0, 100), bar("1Hour", 1, 102), bar("1Hour", 2, 104)];
    const r = resolveHtfFromSnapshot({ bars5m, bars15m, bars1h });
    expect(r.native1h).toBe(true);
    expect(r.native15m).toBe(true);
    expect(r.htf1h).toBe("BULLISH");
    expect(r.htf15m).toBe("BULLISH");
    expect(r.primary).toBe("BULLISH");
  });

  it("trendFromCompletedBars returns UNKNOWN with insufficient bars", () => {
    expect(trendFromCompletedBars([bar("1Hour", 0, 100)], 3)).toBe("UNKNOWN");
  });
});
