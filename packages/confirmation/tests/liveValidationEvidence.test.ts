import { describe, expect, it } from "vitest";
import { verifyLiveValidationEvidence } from "../src/liveValidationEvidence.js";
import type { SignalPerformanceRecord } from "../src/signalPerformance.js";

function baseRow(over: Partial<SignalPerformanceRecord> = {}): SignalPerformanceRecord {
  return {
    id: "sig-1",
    userId: null,
    symbol: "NVDA",
    side: "LONG",
    strategyType: "SCANNER",
    setupId: "setup-1",
    signalTimestamp: "2026-10-13T14:30:00.000Z",
    dataTimestamp: "2026-10-13T14:29:55.000Z",
    marketSession: "REGULAR",
    trigger: 100,
    entryZone: { low: 100, high: 101, executable: true },
    stop: 98,
    target1: 106,
    target2: 108,
    target3: null,
    qualityScore10: 7,
    setupScore100: 70,
    falseBreakoutRisk: null,
    state: "ENTRY_ACTIVE_LONG",
    actionable: true,
    dataQualityOk: true,
    confirmationSummary: [],
    outcomeStatus: "WIN",
    outcomeR: (106 - 100.5) / (100.5 - 98),
    source: "LIVE",
    liveValidated: false,
    ...over,
  };
}

describe("verifyLiveValidationEvidence", () => {
  it("rejects incomplete levels / replay / missing bars", () => {
    const replay = verifyLiveValidationEvidence(baseRow({ source: "HISTORICAL_REPLAY" }), []);
    expect(replay.ok).toBe(false);
    expect(replay.errors.some((e) => e.includes("source_live"))).toBe(true);

    const noBars = verifyLiveValidationEvidence(baseRow(), []);
    expect(noBars.ok).toBe(false);
    expect(noBars.errors.some((e) => e.includes("market_bars"))).toBe(true);
  });

  it("accepts path when bars hit T1 without stop", () => {
    const row = baseRow();
    const mid = (row.entryZone.low + row.entryZone.high) / 2;
    const risk = mid - row.stop;
    const expectedR = (row.target1 - mid) / risk;
    row.outcomeR = expectedR;

    const bars = [
      {
        high: 101,
        low: 100,
        close: 100.5,
        timestamp: "2026-10-13T14:30:00.000Z",
      },
      {
        high: 106.2,
        low: 100.2,
        close: 105,
        timestamp: "2026-10-13T14:35:00.000Z",
      },
    ];
    const result = verifyLiveValidationEvidence(row, bars);
    expect(result.ok).toBe(true);
    expect(result.evidence.recomputedDetail).toBe("HIT_T1");
    expect(result.evidence.automaticOrders).toBe(false);
    expect(result.evidence.disclaimer.toLowerCase()).toContain("not executed");
  });

  it("rejects when recorded outcome does not match bar path", () => {
    const row = baseRow({ outcomeStatus: "LOSS", outcomeR: -1 });
    const bars = [
      {
        high: 106.5,
        low: 100.1,
        close: 105,
        timestamp: "2026-10-13T14:35:00.000Z",
      },
    ];
    const result = verifyLiveValidationEvidence(row, bars);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("outcome_path_verified"))).toBe(true);
  });
});
