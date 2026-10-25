import { describe, expect, it } from "vitest";
import { deriveTradingAction } from "../src/tradingAction.js";
import { applyLabMockEnterDrill } from "../src/labMockEnter.js";
import type { LiveSetupCard } from "../src/liveCard.js";

function minimalWaitCard(): LiveSetupCard {
  return {
    symbol: "NVDA",
    side: "LONG",
    state: "WAIT",
    statusLabel: "WAIT",
    whyMoving: { whyMoving: "—", catalystLabel: null, newsAgeMinutes: null, priceReaction: null },
    conditionsPassed: 3,
    conditionsTotal: 10,
    matrix: {
      rows: [
        {
          id: "DATA_FRESHNESS",
          label: "DATA FRESHNESS",
          status: "PASS",
          reason: "ok",
          requiredForEntry: true,
        },
        {
          id: "RISK_REWARD",
          label: "R:R",
          status: "FAIL",
          reason: "0.2R",
          requiredForEntry: true,
        },
        {
          id: "FIVE_MIN_CONFIRMATION",
          label: "5-MIN CONFIRMATION",
          status: "WAITING",
          reason: "pending",
          requiredForEntry: true,
        },
      ],
      passed: 3,
      total: 10,
      waitingFor: ["pending"],
      allRequiredPassed: false,
    },
    nearActive: {
      active: false,
      conditionsPassed: 3,
      conditionsTotal: 10,
      trigger: 140,
      distanceToTriggerAbs: 0,
      distanceToTriggerPct: 0,
      distanceLabel: "AT TRIGGER",
      stillWaitingFor: ["pending"],
      statusLabel: "WAIT",
      confirmationRequirement: "",
      permissionToEnter: false,
      dataTimestamp: null,
      setupQualityScore: null,
    },
    alertAt: 140,
    entryZone: { low: 139.5, high: 140.5, executable: false },
    stop: 138,
    target1: 145,
    target2: 148,
    setupScore: { total: 40, disclaimer: "", components: [] },
    qualityScore10: null,
    signalIntelligence: null,
    lastPrice: 140,
    lastCompletedBar: null,
    rewardToRisk: 0.2,
    dataFresh: true,
    evaluatedAt: new Date().toISOString(),
    setupId: "NVDA:LONG:140",
    session: null,
    regime: null,
    historicalEdge: null,
    matchedStrategies: [],
    options: null,
    relativeMomentum: null,
    indicatorChecklist: [],
    entryGeometry: null,
    quoteTransparency: null,
    mockRth: true,
  };
}

describe("applyLabMockEnterDrill", () => {
  it("forces ENTRY ACTIVE and deriveTradingAction ENTER", () => {
    const card = applyLabMockEnterDrill(minimalWaitCard());
    expect(card.state).toBe("ENTRY_ACTIVE_LONG");
    expect(card.entryZone.executable).toBe(true);
    expect(card.matrix.allRequiredPassed).toBe(true);
    expect(card.mockEnter).toBe(true);
    expect(card.rewardToRisk).toBeGreaterThanOrEqual(2);
    expect(
      deriveTradingAction({
        state: card.state,
        statusLabel: card.statusLabel,
        userStatus: card.statusLabel,
        dataFresh: card.dataFresh,
        entryExecutable: card.entryZone.executable,
        rewardToRisk: card.rewardToRisk,
        minRewardToRisk: 0,
      }),
    ).toBe("ENTER");
  });
});
