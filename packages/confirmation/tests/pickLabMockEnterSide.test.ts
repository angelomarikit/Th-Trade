import { describe, expect, it } from "vitest";
import type { Bar, MarketSnapshot } from "@wulu/market-data";
import { pickLabMockEnterSide } from "../src/pickLabMockEnterSide.js";

function bar(i: number, o: number, h: number, l: number, c: number): Bar {
  const t = new Date(Date.UTC(2026, 9, 24, 14, i * 5, 0));
  return {
    symbol: "TEST",
    timeframe: "5Min",
    timestamp: t,
    open: o,
    high: h,
    low: l,
    close: c,
    volume: 100_000,
    completed: true,
  };
}

describe("pickLabMockEnterSide", () => {
  it("returns one side for a snapshot (LONG and SHORT picks match)", () => {
    const bars: Bar[] = [];
    let px = 100;
    for (let i = 0; i < 24; i++) {
      px += 0.15;
      bars.push(bar(i, px - 0.1, px + 0.2, px - 0.2, px));
    }
    const snapshot: MarketSnapshot = {
      symbol: "TEST",
      lastPrice: px,
      quote: null,
      bars1m: [],
      bars5m: bars,
      bars15m: [],
      bars1h: [],
      receivedAt: new Date(),
      marketTimestamp: new Date(),
    };
    const picked = pickLabMockEnterSide(snapshot);
    expect(picked === "LONG" || picked === "SHORT").toBe(true);
    expect(pickLabMockEnterSide(snapshot)).toBe(picked);
  });
});
