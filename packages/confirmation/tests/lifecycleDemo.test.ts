import { describe, expect, it } from "vitest";
import type { LiveSetupCard } from "../src/liveCard.js";
import {
  SignalOutcomeTracker,
  outcomeDetailToStatusLabel,
  deriveTradingAction,
} from "../src/index.js";

/** Controlled TSLA-style path: WAIT → ENTRY ACTIVE → TARGET HIT (T1). No live orders. */
function tslaCard(partial: Partial<LiveSetupCard> & Pick<LiveSetupCard, "state">): LiveSetupCard {
  return {
    symbol: "TSLA",
    side: "LONG",
    statusLabel: partial.state,
    state: partial.state as LiveSetupCard["state"],
    whyMoving: { whyMoving: "Demo", catalystLabel: null, newsAgeMinutes: null, priceReaction: null },
    conditionsPassed: 6,
    conditionsTotal: 10,
    matrix: { rows: [], passed: 6, total: 10 },
    nearActive: {
      active: partial.state === "WAIT",
      trigger: 250,
      distanceToTriggerAbs: 1,
      distanceToTriggerPct: 0.4,
      distanceLabel: "0.4% to trigger",
      conditionsPassed: 6,
      conditionsTotal: 10,
      stillWaitingFor: ["Completed 5m close above trigger with volume"],
      confirmationRequirement: "5m confirmation",
      permissionToEnter: false,
      dataTimestamp: "2026-10-15T14:00:00.000Z",
      setupQualityScore: 6,
    },
    alertAt: 250,
    entryZone: partial.entryZone ?? { low: 250.5, high: 251, executable: false },
    stop: 248,
    target1: 254,
    target2: 257,
    target3: 260,
    setupScore: { total: 65, disclaimer: "Not win probability" },
    qualityScore10: { score: 6, reasons: [], disclaimer: "Context only" },
    signalIntelligence: {
      breakout: { mode: "APPROACHING" },
      fakeBreakoutWarnings: [],
      falseBreakoutRisk: "LOW",
      retest: { phase: "NONE", retestRequired: false, model: "NONE" },
      actionHint: "WAIT",
      entryModel: "SCANNER",
    },
    lastPrice: partial.lastPrice ?? 249.5,
    lastCompletedBar: partial.lastCompletedBar ?? null,
    rewardToRisk: 2,
    dataFresh: true,
    evaluatedAt: "2026-10-15T14:00:00.000Z",
    setupId: "TSLA:LONG:250.0000",
    session: { session: "RTH", etLabel: "RTH", tightenConfirmation: false, reason: "demo" },
    regime: null,
    historicalEdge: null,
    matchedStrategies: [{ strategyId: "ORB", strategyName: "Opening Range Breakout", family: "BREAKOUT", reason: "demo" }],
    activeTechnique: null,
    options: null,
    relativeMomentum: null,
    indicatorChecklist: [],
    ...partial,
  } as LiveSetupCard;
}

describe("deriveTradingAction", () => {
  it("NO TRADE with fresh data stays WAIT (watching), MISSED is SKIP", () => {
    expect(
      deriveTradingAction({
        state: "NO_TRADE",
        statusLabel: "NO TRADE",
        userStatus: "NO TRADE",
        dataFresh: true,
        entryExecutable: false,
      }),
    ).toBe("WAIT");
    expect(
      deriveTradingAction({
        state: "MISSED",
        statusLabel: "MISSED",
        userStatus: "MISSED",
        dataFresh: true,
        entryExecutable: false,
      }),
    ).toBe("SKIP");
  });
});

describe("lifecycle demo (TSLA simulation)", () => {
  it("WAIT → ENTRY ACTIVE → TARGET HIT (T1) with alerts-worthy statuses", () => {
    const tracker = new SignalOutcomeTracker();
    const steps: string[] = [];

    const wait = tslaCard({
      state: "WAIT",
      lastCompletedBar: {
        high: 249.8,
        low: 249.2,
        close: 249.5,
        timestamp: "2026-10-15T13:55:00.000Z",
      },
    });
    steps.push(
      deriveTradingAction({
        state: wait.state,
        statusLabel: wait.statusLabel,
        userStatus: "WAIT",
        dataFresh: true,
        entryExecutable: wait.entryZone.executable,
      }),
    );

    const entry = tslaCard({
      state: "ENTRY_ACTIVE_LONG",
      statusLabel: "ENTRY ACTIVE",
      entryZone: { low: 250.5, high: 251, executable: true },
      lastPrice: 250.8,
      lastCompletedBar: {
        high: 251,
        low: 250.4,
        close: 250.8,
        timestamp: "2026-10-15T14:00:00.000Z",
      },
    });
    const opened = tracker.onCard(entry, null, "HISTORICAL_REPLAY", entry.lastCompletedBar);
    expect(opened.opened?.symbol).toBe("TSLA");
    steps.push("ENTER");

    const targetBar = {
      high: 254.2,
      low: 251,
      close: 253.8,
      timestamp: "2026-10-15T14:05:00.000Z",
    };
    const after = tracker.onCard(entry, null, "HISTORICAL_REPLAY", targetBar);
    expect(after.resolution?.detail).toBe("HIT_T1");
    const label = outcomeDetailToStatusLabel(after.resolution!.detail);
    expect(label).toBe("TARGET HIT (T1)");
    steps.push(
      deriveTradingAction({
        state: entry.state,
        statusLabel: label,
        userStatus: label,
        dataFresh: true,
        entryExecutable: false,
        outcomeDetail: after.resolution!.detail,
      }),
    );

    expect(steps).toEqual(["WAIT", "ENTER", "SKIP"]);
  });

  it("ENTRY ACTIVE → STOP HIT", () => {
    const tracker = new SignalOutcomeTracker();
    const entry = tslaCard({
      state: "ENTRY_ACTIVE_LONG",
      statusLabel: "ENTRY ACTIVE",
      entryZone: { low: 250.5, high: 251, executable: true },
      lastCompletedBar: {
        high: 251,
        low: 250.4,
        close: 250.8,
        timestamp: "2026-10-15T14:00:00.000Z",
      },
    });
    tracker.onCard(entry, null, "HISTORICAL_REPLAY", entry.lastCompletedBar!);
    const stopBar = {
      high: 250,
      low: 247.5,
      close: 248.2,
      timestamp: "2026-10-15T14:05:00.000Z",
    };
    const hit = tracker.onCard(entry, null, "HISTORICAL_REPLAY", stopBar);
    expect(hit.resolution?.detail).toBe("HIT_STOP");
    expect(outcomeDetailToStatusLabel(hit.resolution!.detail)).toBe("STOP HIT");
    expect(
      deriveTradingAction({
        state: entry.state,
        statusLabel: "STOP HIT",
        userStatus: "STOP HIT",
        dataFresh: true,
        entryExecutable: false,
        outcomeDetail: hit.resolution!.detail,
      }),
    ).toBe("INVALIDATED");
  });
});
