import { describe, expect, it } from "vitest";
import { MockMarketDataProvider } from "@wulu/market-data";
import {
  buildRelativeMomentum,
  rankByRelativeMomentum,
} from "../src/relativeMomentum.js";

const RTH_NOW = new Date("2026-10-09T14:45:00Z");

describe("relativeMomentum", () => {
  it("computes vs-SPY from actual bars and does not invent nulls away", async () => {
    const md = new MockMarketDataProvider({
      symbol: "NVDA",
      side: "LONG",
      basePrice: 120,
      aboveVwap: true,
      highVolume: true,
      staleMs: 3_000,
      now: RTH_NOW,
    });
    const symbolSnapshot = await md.getSnapshot("NVDA");
    const spy = await md.getSnapshot("SPY");
    const mom = buildRelativeMomentum({
      symbolSnapshot,
      spy,
      qqq: null,
      sectorEtf: "SMH",
      sector: null,
      feed: "iex",
    });

    expect(mom.feed).toBe("iex");
    expect(mom.feedLimitation).toMatch(/IEX/i);
    expect(mom.sectorEtf).toBe("SMH");
    expect(mom.rankScore).toBeGreaterThanOrEqual(0);
    expect(mom.rankScore).toBeLessThanOrEqual(100);
    expect(mom.permissionToEnter).toBeUndefined();
    expect(Array.isArray(mom.notes)).toBe(true);
  });

  it("ranks candidates by score without fabricating symbols", () => {
    const ranked = rankByRelativeMomentum([
      {
        symbol: "AAA",
        momentum: {
          feed: "iex",
          feedLimitation: "x",
          symbolIntradayPct: 1,
          spyIntradayPct: 0.2,
          qqqIntradayPct: null,
          sectorEtf: "XLK",
          sectorIntradayPct: null,
          vsSpyPct: 1.2,
          vsQqqPct: null,
          vsSectorPct: null,
          gapPct: 0.1,
          rvol: 1.8,
          vwapLocation: "ABOVE",
          intradayTrend: "BULLISH",
          rankScore: 80,
          notes: [],
        },
      },
      {
        symbol: "BBB",
        momentum: {
          feed: "iex",
          feedLimitation: "x",
          symbolIntradayPct: -0.5,
          spyIntradayPct: 0.2,
          qqqIntradayPct: null,
          sectorEtf: "XLF",
          sectorIntradayPct: null,
          vsSpyPct: -1,
          vsQqqPct: null,
          vsSectorPct: null,
          gapPct: 0,
          rvol: 0.6,
          vwapLocation: "BELOW",
          intradayTrend: "BEARISH",
          rankScore: 30,
          notes: [],
        },
      },
    ]);
    expect(ranked[0]!.symbol).toBe("AAA");
    expect(ranked[0]!.rank).toBe(1);
    expect(ranked[1]!.symbol).toBe("BBB");
    expect(ranked[1]!.rank).toBe(2);
  });
});
