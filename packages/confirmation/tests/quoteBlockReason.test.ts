import { describe, expect, it } from "vitest";
import { describeQuoteBlock, type MarketSnapshot } from "@wulu/market-data";

function snap(bid: number, ask: number): MarketSnapshot {
  return {
    symbol: "MU",
    lastPrice: (bid + ask) / 2,
    quote: { symbol: "MU", bid, ask, timestamp: new Date() },
    bars1m: [],
    bars5m: [],
    receivedAt: new Date(),
    marketTimestamp: new Date(),
  } as MarketSnapshot;
}

describe("describeQuoteBlock (Blueprint v1.3 Step 3)", () => {
  it("names SPREAD when the IEX spread is above the RTH 0.2% limit", () => {
    const r = describeQuoteBlock(snap(890.0, 902.27), 0.2);
    expect(r).toMatch(/^SPREAD TOO WIDE — 1\.37% > 0\.2% limit/);
  });

  it("returns null for a tight, usable quote", () => {
    expect(describeQuoteBlock(snap(100.21, 100.22), 0.2)).toBeNull();
  });

  it("names a missing quote", () => {
    const s = snap(1, 1);
    s.quote = null;
    expect(describeQuoteBlock(s, 0.2)).toMatch(/^QUOTE MISSING/);
  });
});
