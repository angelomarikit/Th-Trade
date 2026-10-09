import { describe, expect, it } from "vitest";
import { deriveRecommendation, toTradeAction } from "./engine.js";

describe("deriveRecommendation", () => {
  it("fail-closes on stale data", () => {
    const r = deriveRecommendation({
      status: "DATA NOT VERIFIED",
      dataFresh: false,
      session: "RTH",
      conditionsPassed: 8,
      conditionsTotal: 10,
      rewardToRisk: 2,
      setupScore: 80,
      waitingFor: [],
    });
    expect(r.recommendation).toBe("NO_TRADE");
  });

  it("returns ACTIONABLE only when entry-active and fresh", () => {
    const r = deriveRecommendation({
      status: "ENTRY ACTIVE LONG",
      dataFresh: true,
      session: "RTH",
      conditionsPassed: 9,
      conditionsTotal: 10,
      rewardToRisk: 2.1,
      setupScore: 72,
      waitingFor: [],
    });
    expect(r.recommendation).toBe("ACTIONABLE");
  });

  it("returns WATCH/PREPARE for near-active", () => {
    const r = deriveRecommendation({
      status: "NEAR ACTIVE",
      dataFresh: true,
      session: "RTH",
      conditionsPassed: 6,
      conditionsTotal: 10,
      rewardToRisk: 1.8,
      setupScore: 55,
      waitingFor: ["5m confirmation"],
    });
    expect(["WATCH", "PREPARE"]).toContain(r.recommendation);
  });

  it("maps ACTIONABLE to BUY/SELL by side", () => {
    expect(toTradeAction("LONG", "ACTIONABLE")).toBe("BUY");
    expect(toTradeAction("SHORT", "ACTIONABLE")).toBe("SELL");
    expect(toTradeAction("LONG", "WATCH")).toBe("WAIT");
    expect(toTradeAction("SHORT", "NO_TRADE")).toBe("WAIT");
  });
});
