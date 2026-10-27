import { describe, expect, it } from "vitest";
import type { DecisionJournalEntry } from "../src/lib/api";
import { decisionChangeKey, decisionHistoryChanges } from "../src/lib/decisionHistory";

function row(partial: Partial<DecisionJournalEntry> & { id: string; decisionAt: string }): DecisionJournalEntry {
  return {
    symbol: "TSLA",
    side: "LONG",
    state: "NO_TRADE",
    strategyId: null,
    strategyName: null,
    tradingAction: "SKIP",
    setupScore: null,
    marketRegime: null,
    hasCatalyst: false,
    outcome: { status: "NOT_APPLICABLE" },
    evaluationId: null,
    ...partial,
  };
}

describe("decisionHistoryChanges", () => {
  it("collapses consecutive identical decisions and keeps newest first", () => {
    const entries = [
      row({ id: "1", decisionAt: "2026-10-27T14:00:00.000Z", tradingAction: "WAIT" }),
      row({ id: "2", decisionAt: "2026-10-27T14:05:00.000Z", tradingAction: "WAIT" }),
      row({ id: "3", decisionAt: "2026-10-27T14:10:00.000Z", tradingAction: "SKIP", state: "NO_TRADE" }),
    ];
    const changes = decisionHistoryChanges(entries);
    expect(changes.map((e) => e.id)).toEqual(["3", "1"]);
    expect(decisionChangeKey(changes[0]!)).not.toBe(decisionChangeKey(changes[1]!));
  });
});
