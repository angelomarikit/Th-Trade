import { describe, expect, it } from "vitest";
import type { DiscoverySnapshot } from "@wulu/market-data";
import { defaultDiscoveryUniverse, resolveDiscoveryUniverse } from "../src/liquidUniverse.js";
import { scoreDiscoveryUniverse } from "../src/discoveryScore.js";

function snap(partial: Partial<DiscoverySnapshot> & { symbol: string }): DiscoverySnapshot {
  return {
    lastPrice: 100,
    prevClose: 100,
    dayOpen: 100,
    dayHigh: 101,
    dayLow: 99,
    dayVolume: 1_000_000,
    prevDayVolume: 500_000,
    minuteClose: 100,
    minuteVolume: 10_000,
    bid: 99.9,
    ask: 100.1,
    marketTimestamp: new Date("2026-10-13T14:00:00Z"),
    receivedAt: new Date("2026-10-13T14:00:00Z"),
    ...partial,
  };
}

describe("liquidUniverse", () => {
  it("includes major names and ETFs", () => {
    const u = defaultDiscoveryUniverse();
    expect(u.length).toBeGreaterThan(60);
    expect(u).toContain("NVDA");
    expect(u).toContain("SPY");
    expect(u).toContain("SMH");
  });

  it("honors DISCOVERY_UNIVERSE env", () => {
    expect(resolveDiscoveryUniverse({ DISCOVERY_UNIVERSE: "AAA,BBB" })).toEqual(["AAA", "BBB"]);
  });
});

describe("scoreDiscoveryUniverse", () => {
  it("ranks relative strength LONG above laggard and keeps ETFs out of lists", () => {
    const { long, short } = scoreDiscoveryUniverse({
      snaps: [
        snap({ symbol: "SPY", lastPrice: 100, prevClose: 100, dayVolume: 2e6, prevDayVolume: 2e6 }),
        snap({
          symbol: "NVDA",
          lastPrice: 110,
          prevClose: 100,
          dayVolume: 3e6,
          prevDayVolume: 1e6,
        }),
        snap({
          symbol: "SLOW",
          lastPrice: 95,
          prevClose: 100,
          dayVolume: 2e5,
          prevDayVolume: 1e6,
        }),
        snap({ symbol: "XLK", lastPrice: 101, prevClose: 100 }),
      ],
    });
    expect(long.map((r) => r.symbol)).toContain("NVDA");
    expect(long.map((r) => r.symbol)).not.toContain("SPY");
    expect(long.map((r) => r.symbol)).not.toContain("XLK");
    const nvda = long.find((r) => r.symbol === "NVDA")!;
    const slow = long.find((r) => r.symbol === "SLOW")!;
    expect(nvda.rankScore).toBeGreaterThan(slow.rankScore);
    const slowShort = short.find((r) => r.symbol === "SLOW")!;
    const nvdaShort = short.find((r) => r.symbol === "NVDA")!;
    expect(slowShort.rankScore).toBeGreaterThan(nvdaShort.rankScore);
  });

  it("does not top-rank a large mover without volume and relative strength", () => {
    const { long } = scoreDiscoveryUniverse({
      snaps: [
        snap({ symbol: "SPY", lastPrice: 100, prevClose: 100, dayVolume: 2e6, prevDayVolume: 2e6 }),
        // Big green day but flat vs SPY-like market and weak volume
        snap({
          symbol: "PUMP",
          lastPrice: 103.5,
          prevClose: 100,
          dayVolume: 4e5,
          prevDayVolume: 1e6,
          bid: 103.4,
          ask: 103.6,
        }),
        // Modest outperformance with real volume
        snap({
          symbol: "QUAL",
          lastPrice: 102,
          prevClose: 100,
          dayVolume: 2.5e6,
          prevDayVolume: 1e6,
          bid: 101.95,
          ask: 102.05,
        }),
      ],
    });
    const pump = long.find((r) => r.symbol === "PUMP")!;
    const qual = long.find((r) => r.symbol === "QUAL")!;
    expect(qual.rankScore).toBeGreaterThan(pump.rankScore);
    expect(pump.rankScore).toBeLessThanOrEqual(78);
  });

  it("does not invent day change when prevClose missing", () => {
    const { features } = scoreDiscoveryUniverse({
      snaps: [snap({ symbol: "SPY" }), snap({ symbol: "ZZZ", prevClose: null })],
    });
    const z = features.find((f) => f.symbol === "ZZZ")!;
    expect(z.dayChangePct).toBeNull();
    expect(z.notes.some((n) => n.toLowerCase().includes("prior close"))).toBe(true);
  });
});
