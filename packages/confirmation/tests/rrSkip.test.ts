import { describe, expect, it } from "vitest";
import { buildWatchingSummary, deriveTradingAction } from "../src/tradingAction.js";

const base = {
  state: "WAITING",
  statusLabel: "WAIT",
  userStatus: "WAIT",
  dataFresh: true,
  entryExecutable: false,
};

describe("R:R below 2.0 => SKIP (Blueprint v1.3 Step 5)", () => {
  it("NVDA 0.14R with verified data is SKIP, not WAIT", () => {
    expect(deriveTradingAction({ ...base, rewardToRisk: 0.14 })).toBe("SKIP");
  });

  it("exactly 2.0R stays WAIT (boundary passes)", () => {
    expect(deriveTradingAction({ ...base, rewardToRisk: 2 })).toBe("WAIT");
  });

  it("unverified data stays WAIT (DATA NOT VERIFIED wins)", () => {
    expect(deriveTradingAction({ ...base, dataFresh: false, rewardToRisk: 0.18 })).toBe(
      "WAIT",
    );
  });

  it("no levels yet (0R) is not a verdict", () => {
    expect(deriveTradingAction({ ...base, rewardToRisk: 0 })).toBe("WAIT");
  });

  it("minRewardToRisk 0 disables R:R SKIP (lab sim RTH)", () => {
    expect(deriveTradingAction({ ...base, rewardToRisk: 0.14, minRewardToRisk: 0 })).toBe(
      "WAIT",
    );
  });

  it("summary names the R:R reason", () => {
    const s = buildWatchingSummary({
      symbol: "NVDA",
      side: "LONG",
      strategyName: "VWAP Reclaim",
      alertAt: 217.69,
      waitingFor: [],
      tradingAction: "SKIP",
      rewardToRisk: 0.14,
    });
    expect(s).toContain("R:R 0.14 is below the 2.0 minimum");
  });
});
