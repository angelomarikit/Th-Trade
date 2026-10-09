import { describe, expect, it } from "vitest";
import { evaluateRegimeAlignment } from "../src/alignment.js";
import { evaluateMarketRegime } from "../src/RegimeEngine.js";
import { makeIndexSnapshot } from "../src/fixtures.js";
import { buildMorningBrief } from "../src/morningBrief.js";
import { atrPct, completedBars, trendSlopePct } from "../src/technicals.js";

describe("RegimeEngine", () => {
  it("classifies bullish SPY fixture as TRENDING_BULLISH / BULLISH bias", () => {
    const spy = makeIndexSnapshot({ symbol: "SPY", trend: "bullish", basePrice: 500 });
    const qqq = makeIndexSnapshot({ symbol: "QQQ", trend: "bullish", basePrice: 450 });
    const regime = evaluateMarketRegime({ spy, qqq, iwm: null });

    expect(regime.trend).toBe("BULLISH");
    expect(regime.primary).toBe("TRENDING_BULLISH");
    expect(regime.bias).toBe("BULLISH");
    expect(regime.strategyGates.openingRangeBreakout).toBe(true);
    expect(regime.reasons.length).toBeGreaterThan(0);
  });

  it("classifies bearish SPY fixture as TRENDING_BEARISH", () => {
    const spy = makeIndexSnapshot({ symbol: "SPY", trend: "bearish", basePrice: 500 });
    const regime = evaluateMarketRegime({ spy });
    expect(regime.trend).toBe("BEARISH");
    expect(regime.primary).toBe("TRENDING_BEARISH");
    expect(evaluateRegimeAlignment(regime, "LONG").status).toBe("FAIL");
    expect(evaluateRegimeAlignment(regime, "SHORT").status).toBe("PASS");
  });

  it("uses only completed bars (no look-ahead)", () => {
    const spy = makeIndexSnapshot({ symbol: "SPY", trend: "bullish", basePrice: 100 });
    const last = spy.bars5m.at(-1)!;
    last.completed = false;
    last.close = 9999; // would skew slope if included

    const completed = completedBars(spy.bars5m);
    expect(completed.every((b) => b.completed)).toBe(true);
    const slope = trendSlopePct(spy.bars5m, 10);
    expect(slope).not.toBeNull();
    expect(Math.abs(slope!)).toBeLessThan(50);
    expect(atrPct(spy.bars5m, 14)).not.toBeNull();
  });

  it("morning brief can return zero candidates", () => {
    const spy = makeIndexSnapshot({ symbol: "SPY", trend: "range", basePrice: 500 });
    const regime = evaluateMarketRegime({ spy });
    const brief = buildMorningBrief({ regime, setups: [] });
    expect(brief.candidates).toHaveLength(0);
    expect(brief.note).toMatch(/empty candidates/i);
  });
});
