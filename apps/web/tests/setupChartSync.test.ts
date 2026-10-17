import { describe, expect, it } from "vitest";
import { canShowSetupChartLevels, isSetupChartStale } from "../src/lib/setupChartSync";

describe("setupChartSync", () => {
  it("hides levels when setup symbol or bars do not match active ticker", () => {
    expect(
      isSetupChartStale({
        symbol: "MU",
        setupSymbol: "NVDA",
        barsSymbol: "MU",
        setupEvaluatedAt: new Date().toISOString(),
      }),
    ).toBe(true);
    expect(
      isSetupChartStale({
        symbol: "MU",
        setupSymbol: "MU",
        barsSymbol: "NVDA",
        setupEvaluatedAt: new Date().toISOString(),
      }),
    ).toBe(true);
  });

  it("hides levels when evaluation is older than 30s", () => {
    const old = new Date(Date.now() - 31_000).toISOString();
    expect(
      isSetupChartStale({
        symbol: "SPY",
        setupSymbol: "SPY",
        barsSymbol: "SPY",
        setupEvaluatedAt: old,
      }),
    ).toBe(true);
  });

  it("shows levels only when fresh, matching, and data verified", () => {
    const fresh = new Date().toISOString();
    expect(
      canShowSetupChartLevels({
        symbol: "SPY",
        setupSymbol: "SPY",
        barsSymbol: "SPY",
        setupEvaluatedAt: fresh,
        dataFresh: true,
      }),
    ).toBe(true);
    expect(
      canShowSetupChartLevels({
        symbol: "SPY",
        setupSymbol: "SPY",
        barsSymbol: "SPY",
        setupEvaluatedAt: fresh,
        dataFresh: false,
      }),
    ).toBe(false);
  });
});
