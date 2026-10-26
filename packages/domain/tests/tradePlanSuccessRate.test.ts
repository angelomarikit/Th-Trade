import { describe, expect, it } from "vitest";
import { buildTradePlanSuccessRate, MIN_HISTORICAL_WIN_RATE_SAMPLE } from "../src/tradePlanSuccessRate.js";

describe("buildTradePlanSuccessRate", () => {
  it("suppresses win rate when sample below minimum", () => {
    const r = buildTradePlanSuccessRate({
      sampleSize: 1,
      winRatePct: 100,
      activeStrategyName: "Breakout + Retest",
    });
    expect(r.winRatePct).toBeNull();
    expect(r.showWinRatePct).toBe(false);
    expect(r.headline).toContain(`n=${1}`);
    expect(r.headline).toContain(String(MIN_HISTORICAL_WIN_RATE_SAMPLE));
  });

  it("shows win rate at sufficient sample", () => {
    const r = buildTradePlanSuccessRate({
      sampleSize: 12,
      winRatePct: 58,
      activeStrategyName: "VWAP Reclaim",
    });
    expect(r.winRatePct).toBe(58);
    expect(r.showWinRatePct).toBe(true);
    expect(r.strategyName).toBe("VWAP Reclaim");
  });
});
