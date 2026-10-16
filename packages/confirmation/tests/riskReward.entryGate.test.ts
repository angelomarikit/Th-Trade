import { describe, expect, it } from "vitest";
import {
  conservativeEntryPriceForRisk,
  computeRiskRewardAtEntry,
  type TradeLevels,
} from "@wulu/domain";

describe("ENTRY ACTIVE R:R gate", () => {
  const levels: TradeLevels = {
    side: "LONG",
    trigger: 913.23,
    entryZoneLow: 913.23,
    entryZoneHigh: 916,
    stop: 902.5,
    target1: 939,
    target2: 950,
    target3: 960,
  };

  it("uses top-of-zone conservative entry for LONG", () => {
    expect(conservativeEntryPriceForRisk(levels, 926)).toBe(916);
  });

  it("blocks ENTRY when conservative R:R below 2 even if mid-zone math looked ok", () => {
    const entry = conservativeEntryPriceForRisk(levels, 915);
    const rr = computeRiskRewardAtEntry(levels, entry, 2);
    expect(rr.meetsMinimum).toBe(false);
  });

  it("allows PASS only when conservative entry meets 2R", () => {
    const generous: TradeLevels = {
      ...levels,
      target1: 950,
    };
    const rr = computeRiskRewardAtEntry(
      generous,
      conservativeEntryPriceForRisk(generous, 914),
      2,
    );
    expect(rr.meetsMinimum).toBe(true);
  });
});
