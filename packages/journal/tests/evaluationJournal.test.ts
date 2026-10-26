import { describe, expect, it } from "vitest";
import { evaluateSetup } from "@wulu/confirmation";
import { MockMarketDataProvider } from "@wulu/market-data";
import {
  EvaluationPersistGate,
  MemoryJournalStore,
  SignalJournal,
  calibrationToCsv,
} from "../src/index.js";

const RTH_NOW = new Date("2026-10-09T14:45:00Z");

async function sampleCard() {
  const md = new MockMarketDataProvider({
    symbol: "TEST",
    side: "LONG",
    basePrice: 100,
    aboveVwap: true,
    highVolume: true,
    now: RTH_NOW,
  });
  const snapshot = await md.getSnapshot("TEST");
  return evaluateSetup({
    symbol: "TEST",
    side: "LONG",
    snapshot,
    now: RTH_NOW,
    whyMoving: {
      whyMoving: "Fixture",
      catalystLabel: null,
      newsAgeMinutes: null,
      priceReaction: null,
      hasVerifiedCatalyst: false,
    },
  });
}

describe("evaluation journal + calibration export", () => {
  it("persists calibration block with evaluationId and HTF matrix slots", async () => {
    const journal = new SignalJournal(new MemoryJournalStore());
    const card = await sampleCard();
    const entry = journal.record(card);
    expect(entry).not.toBeNull();
    expect(entry!.calibration.evaluationId).toContain(card.setupId);
    expect(entry!.calibration.tradingAction).toMatch(/WAIT|ENTER|SKIP|INVALIDATED/);
    expect(entry!.features.setupId).toBe(card.setupId);
  });

  it("suppresses duplicate polls until 5m bar or phase changes", async () => {
    const gate = new EvaluationPersistGate();
    const card = await sampleCard();
    expect(gate.shouldRecord(card)).toBe(true);
    expect(gate.shouldRecord(card)).toBe(false);
  });

  it("exports CSV rows for calibration", async () => {
    const journal = new SignalJournal(new MemoryJournalStore());
    journal.record(await sampleCard());
    const csv = journal.exportCalibration({}, "csv");
    expect(csv.split("\n")[0]).toContain("evaluationId");
    expect(csv).toContain("TEST");
  });
});
