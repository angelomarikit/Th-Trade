import { describe, expect, it } from "vitest";
import type { LiveSetupCard } from "@wulu/confirmation";
import { buildTradePlan } from "./tradePlan.js";

function minimalCard(overrides: Partial<LiveSetupCard> = {}): LiveSetupCard {
  return {
    symbol: "NVDA",
    side: "LONG",
    state: "NEAR_ACTIVE",
    statusLabel: "NEAR ACTIVE",
    whyMoving: { whyMoving: "Test", catalystLabel: null, newsAgeMinutes: null, priceReaction: null },
    conditionsPassed: 5,
    conditionsTotal: 7,
    matrix: {
      rows: [
        {
          id: "fresh",
          label: "Data fresh",
          status: "PASS",
          reason: "ok",
          requiredForEntry: true,
        },
        {
          id: "rvol",
          label: "RVOL",
          status: "WAITING",
          reason: "need volume",
          requiredForEntry: true,
        },
      ],
    },
    nearActive: {
      active: true,
      distanceLabel: "0.2% below trigger",
      distanceToTriggerPct: -0.2,
      stillWaitingFor: ["5m confirmation"],
      dataTimestamp: null,
      conditionsPassed: 5,
      conditionsTotal: 7,
      confirmationRequirement: "close",
      permissionToEnter: false,
      setupQualityScore: 6,
    },
    alertAt: 100,
    entryZone: { low: 99.5, high: 100.5, executable: false },
    stop: 98,
    target1: 104,
    target2: 108,
    setupScore: { total: 65, disclaimer: "context" },
    qualityScore10: {
      score: 7,
      reasons: [],
      disclaimer: "Quality score is NOT win probability.",
    },
    signalIntelligence: null,
    lastPrice: 99.8,
    lastCompletedBar: null,
    rewardToRisk: 2.1,
    dataFresh: true,
    evaluatedAt: new Date().toISOString(),
    setupId: "test",
    session: { session: "RTH", etLabel: "10:00 ET", tightenConfirmation: false, reason: "" },
    regime: null,
    historicalEdge: {
      strategyId: "x",
      strategyName: "Breakout retest",
      sampleSize: 12,
      winRatePct: 58,
      averageWinnerR: 1.8,
      averageLoserR: -1,
      expectancyR: 0.35,
      profitFactor: null,
      maxDrawdownR: null,
      bestRegime: null,
      disclaimer: "Historical context only.",
      collapsedSummary: "58% over 12 samples",
    },
    matchedStrategies: [],
    activeTechnique: null,
    options: null,
    relativeMomentum: null,
    indicatorChecklist: [],
    ...overrides,
  } as LiveSetupCard;
}

describe("buildTradePlan", () => {
  it("includes historical win rate in successRate block", async () => {
    const plan = await buildTradePlan({
      card: minimalCard(),
      side: "LONG",
      tradingAction: "WAIT",
      withModel: false,
    });
    expect(plan.successRate.winRatePct).toBe(58);
    expect(plan.successRate.sampleSize).toBe(12);
    expect(plan.sections.whatToDoNow).toMatch(/WAIT/i);
    expect(plan.gatesBlocking.some((g) => g.label === "RVOL")).toBe(true);
  });
});
