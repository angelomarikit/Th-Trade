import { describe, expect, it } from "vitest";
import type { Bar } from "@wulu/market-data";
import { computeRiskReward } from "@wulu/domain";
import { deriveLevels } from "../src/deriveLevels.js";

function bar(
  t: string,
  o: number,
  h: number,
  l: number,
  c: number,
  completed = true,
): Bar {
  return {
    symbol: "SPY",
    timeframe: "5Min",
    timestamp: new Date(t),
    open: o,
    high: h,
    low: l,
    close: c,
    volume: 50_000,
    vwap: (h + l + c) / 3,
    completed,
  };
}

describe("deriveLevels geometry", () => {
  it("keeps LONG target1 strictly above entry zone (no SPY-style 0.01 R:R)", () => {
    // Consolidation then price already trading above prior range high / trigger.
    const bars: Bar[] = [];
    for (let i = 0; i < 20; i++) {
      const base = 770 + (i % 3) * 0.2;
      bars.push(
        bar(
          `2026-10-13T14:${String(i).padStart(2, "0")}:00Z`,
          base,
          base + 1.5,
          base - 1.2,
          base + 0.3,
        ),
      );
    }
    // Last completed: trade through highs so lastPrice is above trigger zone.
    bars.push(bar("2026-10-13T14:20:00Z", 773, 778, 772.5, 777.5));
    const levels = deriveLevels(bars, "LONG", 777.5);
    expect(levels.stop).toBeLessThan(levels.entryZoneLow);
    expect(levels.target1).toBeGreaterThan(levels.entryZoneHigh);
    expect(levels.target2).toBeGreaterThan(levels.target1);
    const rr = computeRiskReward(levels);
    // Must not report near-zero R:R from T1 inside the entry zone.
    expect(rr.target1Distance).toBeGreaterThan(0.05);
    expect(rr.rewardToRisk).toBeGreaterThan(0.05);
  });

  it("keeps SHORT target1 strictly below entry zone", () => {
    const bars: Bar[] = [];
    for (let i = 0; i < 20; i++) {
      const base = 200 - (i % 3) * 0.15;
      bars.push(
        bar(
          `2026-10-13T15:${String(i).padStart(2, "0")}:00Z`,
          base,
          base + 1.2,
          base - 1.4,
          base - 0.2,
        ),
      );
    }
    bars.push(bar("2026-10-13T15:20:00Z", 198, 198.5, 194, 194.5));
    const levels = deriveLevels(bars, "SHORT", 194.5);
    expect(levels.stop).toBeGreaterThan(levels.entryZoneHigh);
    expect(levels.target1).toBeLessThan(levels.entryZoneLow);
    expect(levels.target2).toBeLessThan(levels.target1);
    const rr = computeRiskReward(levels);
    expect(rr.rewardToRisk).toBeGreaterThan(0.05);
  });
});
