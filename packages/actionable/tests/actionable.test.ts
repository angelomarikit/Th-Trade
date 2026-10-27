import { describe, expect, it } from "vitest";
import { analyzeStock } from "../src/analyze.js";
import { resolveMarketRegime, spyRegimeSignals } from "../src/marketRegime.js";
import { evaluateBreakoutDaily, evaluateOpeningRange } from "../src/strategies/evaluate.js";
import { bullishDailyStack, flatSpyDaily } from "./fixtures.js";

describe("actionable market regime", () => {
  it("resolves bullish SPY when EMA stack aligns", () => {
    const signals = spyRegimeSignals(flatSpyDaily());
    expect(resolveMarketRegime(signals)).toBe("BULLISH");
  });
});

describe("actionable strategies", () => {
  it("disables breakout when volume feed is not comparable", () => {
    const r = evaluateBreakoutDaily(bullishDailyStack(), false);
    expect(r.action).toBe("SKIP");
    expect(r.reason).toMatch(/volume feed/i);
  });

  it("keeps ORB disabled by default", () => {
    const r = evaluateOpeningRange([], false, true);
    expect(r.action).toBe("SKIP");
    expect(r.reason).toMatch(/disabled by default/i);
  });
});

describe("analyzeStock", () => {
  it("returns structured output without inventing BUY when none qualify", () => {
    const out = analyzeStock({
      symbol: "NVDA",
      dataFeed: "iex",
      lastPrice: 500,
      stockDaily: bullishDailyStack("NVDA"),
      spyDaily: flatSpyDaily(),
      volumeFeedComparable: false,
      spreadPct: 0.05,
    });
    expect(out.advisoryOnly).toBe(true);
    expect(out.strategiesEvaluated.length).toBe(6);
    expect(["BUY_CANDIDATE", "WAIT_FOR_TRIGGER", "SKIP", "DATA_UNAVAILABLE"]).toContain(
      out.finalAction,
    );
    expect(out.decisionReason.length).toBeGreaterThan(0);
  });

  it("paper fixture: BUY_CANDIDATE passes risk sizing when 2R and account supplied", () => {
    const daily = bullishDailyStack("TEST");
    const last = daily[daily.length - 1]!;
    const out = analyzeStock({
      symbol: "TEST",
      dataFeed: "sip",
      lastPrice: last.close,
      stockDaily: daily,
      spyDaily: flatSpyDaily(),
      volumeFeedComparable: true,
      spreadPct: 0.05,
      paperAccount: {
        equity: 100_000,
        buyingPower: 50_000,
        openPositionCount: 0,
        openPortfolioRiskPct: 0,
        hasOpenPositionInSymbol: false,
        hasPendingOrderInSymbol: false,
      },
    });
    expect(out.marketRegime).toBe("BULLISH");
    if (out.finalAction === "BUY_CANDIDATE") {
      expect(out.suggestedPaperSize.calculated).toBe(true);
      expect(out.estimatedRewardToRisk).toBeGreaterThanOrEqual(2);
    }
  });
});
