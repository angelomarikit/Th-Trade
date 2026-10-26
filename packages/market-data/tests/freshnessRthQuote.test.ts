import { describe, expect, it } from "vitest";
import { assessFreshness } from "../src/freshness.js";
import { classifyUsEquitySession } from "../src/session.js";
import type { MarketSnapshot } from "../src/types.js";

const RTH = new Date("2026-10-09T15:00:00.000Z");

function snap(partial: Partial<MarketSnapshot>): MarketSnapshot {
  return {
    symbol: "MU",
    lastPrice: 100,
    quote: null,
    bars1m: [],
    bars5m: [],
    bars15m: [],
    bars1h: [],
    receivedAt: RTH,
    marketTimestamp: RTH,
    ...partial,
  };
}

describe("RTH quote timestamp vs just-fetched NBBO", () => {
  it("passes freshness when quote.t lags but snapshot just fetched with usable NBBO and fresh bars", () => {
    const session = classifyUsEquitySession(RTH);
    const barTs = new Date(RTH.getTime() - 30_000);
    const snapshot = snap({
      receivedAt: RTH,
      quote: {
        symbol: "MU",
        bid: 99.9,
        ask: 100.1,
        timestamp: new Date(RTH.getTime() - 100_000),
      },
      bars1m: [
        {
          symbol: "MU",
          timeframe: "1Min",
          timestamp: barTs,
          open: 99,
          high: 101,
          low: 99,
          close: 100,
          volume: 1000,
          completed: true,
        },
      ],
    });
    const result = assessFreshness(snapshot, RTH, session.maxDataAgeMs, session);
    expect(result.ok).toBe(true);
  });

  it("still fails when quote.t is stale and bars are stale", () => {
    const session = classifyUsEquitySession(RTH);
    const oldBar = new Date(RTH.getTime() - 300_000);
    const snapshot = snap({
      receivedAt: RTH,
      quote: {
        symbol: "MU",
        bid: 99.9,
        ask: 100.1,
        timestamp: new Date(RTH.getTime() - 300_000),
      },
      bars1m: [
        {
          symbol: "MU",
          timeframe: "1Min",
          timestamp: oldBar,
          open: 99,
          high: 101,
          low: 99,
          close: 100,
          volume: 1000,
          completed: true,
        },
      ],
    });
    const result = assessFreshness(snapshot, RTH, session.maxDataAgeMs, session);
    expect(result.ok).toBe(false);
  });
});
