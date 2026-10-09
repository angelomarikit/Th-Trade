import { describe, expect, it } from "vitest";
import { evaluateSetup } from "@wulu/confirmation";
import { MockMarketDataProvider } from "@wulu/market-data";
import {
  FEATURE_SCHEMA_VERSION,
  MemoryJournalStore,
  SignalJournal,
  summarizeJournal,
  trackOutcomeFromBars,
} from "../src/index.js";

const RTH_NOW = new Date("2026-10-09T14:45:00Z");

async function sampleCard(stateHint: "near" | "stale" = "near") {
  const md = new MockMarketDataProvider({
    symbol: "TEST",
    side: "LONG",
    basePrice: 100,
    aboveVwap: true,
    highVolume: true,
    incompleteFiveMin: stateHint === "near",
    staleMs: stateHint === "stale" ? 5 * 60_000 : 2_000,
    now: RTH_NOW,
  });
  const snapshot = await md.getSnapshot("TEST");
  return evaluateSetup({
    symbol: "TEST",
    side: "LONG",
    snapshot,
    now: RTH_NOW,
    whyMoving: {
      whyMoving: "Fixture catalyst",
      catalystLabel: "MODERATE IMPACT BULLISH",
      newsAgeMinutes: 10,
      priceReaction: "CONFIRMING",
      hasVerifiedCatalyst: true,
    },
    matchedStrategies: [
      {
        strategyId: "VWAP_RECLAIM",
        strategyName: "VWAP Reclaim",
        family: "vwapReclaim",
        reason: "test",
      },
    ],
  });
}

describe("Phase E signal journal", () => {
  it("records every evaluation including non-entry states", async () => {
    const journal = new SignalJournal(new MemoryJournalStore());
    const near = await sampleCard("near");
    const stale = await sampleCard("stale");

    const a = journal.record(near);
    const b = journal.record(stale);

    expect(a.state).toBe("NEAR_ACTIVE");
    expect(b.state).toBe("DATA_NOT_VERIFIED");
    expect(journal.count()).toBe(2);
    expect(a.features.schemaVersion).toBe(FEATURE_SCHEMA_VERSION);
    expect(a.features.decisionAt).toBe(near.evaluatedAt);
    expect(a.outcome.status).toBe("NOT_APPLICABLE");
  });

  it("keeps outcomes separate from features (no leakage fields)", async () => {
    const journal = new SignalJournal(new MemoryJournalStore());
    const card = await sampleCard("near");
    // Force entry-active-like outcome tracking path by mutating after record via synthetic entry
    const entry = journal.record(card);
    expect(entry.features).not.toHaveProperty("mfeR");
    expect(entry.features).not.toHaveProperty("rMultiple");

    const rows = journal.exportFeatureRows();
    expect(rows[0]!.features.decisionAt <= entry.decisionAt).toBe(true);
  });

  it("tracks MFE/MAE after entry using later bars only", async () => {
    const journal = new SignalJournal(new MemoryJournalStore());
    const card = await sampleCard("near");
    const entry = journal.record({
      ...card,
      state: "ENTRY_ACTIVE_LONG",
      statusLabel: "ENTRY ACTIVE — LONG",
      entryZone: { low: 100, high: 100.5, executable: true },
      stop: 99,
      target1: 103,
      target2: 105,
      lastPrice: 100.2,
    });

    const decision = new Date(entry.decisionAt).getTime();
    const bars = [0, 1, 2, 3, 4].map((i) => ({
      symbol: "TEST",
      timeframe: "5Min" as const,
      timestamp: new Date(decision + (i + 1) * 300_000),
      open: 100.2 + i * 0.4,
      high: 100.5 + i * 0.5,
      low: 100 + i * 0.3,
      close: 100.3 + i * 0.4,
      volume: 10_000,
      completed: true,
    }));
    // Push through target
    bars[3]!.high = 104;

    const outcome = trackOutcomeFromBars(entry, bars);
    expect(outcome.status).toBe("CLOSED");
    expect(outcome.exitReason).toBe("TARGET");
    expect(outcome.mfeR).not.toBeNull();
    expect(outcome.maeR).not.toBeNull();
    journal.updateOutcome(entry.id, outcome);

    const summary = summarizeJournal(journal.list());
    expect(summary.closedTrades).toBe(1);
    expect(summary.closedWinRate).toBe(1);
  });
});
