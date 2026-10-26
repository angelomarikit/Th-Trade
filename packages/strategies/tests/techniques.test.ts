import { describe, expect, it } from "vitest";
import type { Bar, MarketSnapshot } from "@wulu/market-data";
import { selectPrimaryTechnique } from "../src/techniques/selectPrimary.js";

function bar(i: number, o: number, h: number, l: number, c: number, completed = true): Bar {
  const t = new Date(`2026-10-26T14:${String(i).padStart(2, "0")}:00.000Z`);
  return {
    symbol: "TSLA",
    timeframe: "5Min",
    timestamp: t,
    open: o,
    high: h,
    low: l,
    close: c,
    volume: 1_000_000 + i * 10_000,
    completed,
  };
}

function snapshot(bars5m: Bar[], lastPrice: number): MarketSnapshot {
  return {
    symbol: "TSLA",
    lastPrice,
    quote: { symbol: "TSLA", bid: lastPrice - 0.05, ask: lastPrice + 0.05, timestamp: new Date() },
    bars1m: [],
    bars5m,
    bars15m: [],
    bars1h: [],
    receivedAt: new Date("2026-10-26T14:45:00.000Z"),
    marketTimestamp: bars5m.at(-1)?.timestamp ?? null,
    priceSource: "quote_mid",
  };
}

describe("selectPrimaryTechnique", () => {
  it("labels breakout+retest on failed hold near resistance", () => {
    const bars: Bar[] = [];
    for (let i = 0; i < 14; i++) {
      bars.push(bar(i, 390 + i * 0.2, 391 + i * 0.2, 389, 390.5 + i * 0.15));
    }
    bars.push(bar(14, 395, 396.65, 394.5, 395.45));
    const snap = snapshot(bars, 394.86);
    const t = selectPrimaryTechnique({
      symbol: "TSLA",
      side: "LONG",
      snapshot: snap,
      now: new Date("2026-10-26T14:47:00.000Z"),
      enabledFamilies: { breakoutRetest: true },
    });
    expect(t.strategyName).toMatch(/Breakout/i);
    expect(t.checks.some((c) => c.requiredForEntry)).toBe(true);
    expect(t.invalidationRules.length).toBeGreaterThan(0);
  });

  it("returns a named strategy for every evaluation", () => {
    const bars = [bar(0, 100, 101, 99, 100)];
    const t = selectPrimaryTechnique({
      symbol: "TEST",
      side: "LONG",
      snapshot: snapshot(bars, 100),
    });
    expect(t.strategyName.length).toBeGreaterThan(0);
    expect(t.levels.trigger).toBeGreaterThan(0);
  });
});
