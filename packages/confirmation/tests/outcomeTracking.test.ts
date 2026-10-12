import { describe, expect, it } from "vitest";
import { resolveOutcomeOnBar, SignalOutcomeTracker } from "../src/outcomeTracking.js";
import type { LiveSetupCard } from "../src/liveCard.js";

function card(partial: Partial<LiveSetupCard> & Pick<LiveSetupCard, "state" | "lastPrice">): LiveSetupCard {
  return {
    symbol: "TEST",
    side: "LONG",
    statusLabel: "ENTRY ACTIVE",
    alertAt: 100,
    entryZone: { low: 100, high: 100.5, executable: true },
    stop: 99,
    target1: 102,
    target2: 104,
    target3: 106,
    lastCompletedBar: null,
    rewardToRisk: 2,
    dataFresh: true,
    evaluatedAt: "2026-10-09T14:00:00.000Z",
    setupId: "TEST:LONG:100.0000",
    nearActive: { stillWaitingFor: [] },
    ...partial,
  } as unknown as LiveSetupCard;
}

describe("outcome tracking", () => {
  it("marks same-bar stop and target as ambiguous", () => {
    const r = resolveOutcomeOnBar({
      side: "LONG",
      entryPrice: 100,
      stop: 99,
      target1: 102,
      target2: 104,
      bar: { high: 103, low: 98.5, close: 101, timestamp: "2026-10-09T14:05:00.000Z" },
    });
    expect(r?.detail).toBe("AMBIGUOUS_STOP_AND_TARGET");
    expect(r?.outcomeStatus).toBe("AMBIGUOUS");
  });

  it("scores HIT_T1 for LONG when high clears target and stop holds", () => {
    const r = resolveOutcomeOnBar({
      side: "LONG",
      entryPrice: 100,
      stop: 99,
      target1: 102,
      target2: 104,
      bar: { high: 102.2, low: 100.1, close: 102, timestamp: "2026-10-09T14:10:00.000Z" },
    });
    expect(r?.detail).toBe("HIT_T1");
    expect(r?.outcomeStatus).toBe("WIN");
    expect(r?.outcomeR).toBeCloseTo(2, 5);
  });

  it("scores HIT_STOP for SHORT", () => {
    const r = resolveOutcomeOnBar({
      side: "SHORT",
      entryPrice: 100,
      stop: 101,
      target1: 98,
      target2: 96,
      bar: { high: 101.5, low: 99.5, close: 101.2, timestamp: "2026-10-09T14:10:00.000Z" },
    });
    expect(r?.detail).toBe("HIT_STOP");
    expect(r?.outcomeStatus).toBe("LOSS");
    expect(r?.outcomeR).toBe(-1);
  });

  it("hydrates open tracks after restart", () => {
    const tracker = new SignalOutcomeTracker();
    const n = tracker.hydrate([
      {
        id: "track:LIVE:u1:TEST:LONG:100",
        userId: "u1",
        symbol: "TEST",
        side: "LONG",
        setupId: "TEST:LONG:100.0000",
        entryPrice: 100.2,
        entryAt: "2026-10-09T14:00:00.000Z",
        stop: 99,
        target1: 102,
        target2: 104,
        target3: null,
        source: "LIVE",
        barsElapsed: 3,
        qualityScore10: 7,
        strategyType: "SCANNER",
      },
    ]);
    expect(n).toBe(1);
    expect(tracker.listOpen()).toHaveLength(1);
    expect(tracker.listOpen()[0]?.barsElapsed).toBe(3);
  });

  it("opens on ENTRY ACTIVE then resolves on later bar", () => {
    const tracker = new SignalOutcomeTracker();
    const openCard = card({
      state: "ENTRY_ACTIVE_LONG",
      lastPrice: 100.2,
      lastCompletedBar: {
        high: 100.4,
        low: 100,
        close: 100.2,
        timestamp: "2026-10-09T14:00:00.000Z",
      },
    });
    const opened = tracker.onCard(openCard, "user-1", "HISTORICAL_REPLAY", openCard.lastCompletedBar);
    expect(opened.opened).toBeTruthy();
    expect(opened.resolution).toBeUndefined();

    const later = card({
      state: "ENTRY_ACTIVE_LONG",
      lastPrice: 102.1,
      evaluatedAt: "2026-10-09T14:10:00.000Z",
      lastCompletedBar: {
        high: 102.3,
        low: 100.5,
        close: 102.1,
        timestamp: "2026-10-09T14:10:00.000Z",
      },
    });
    const resolved = tracker.onCard(later, "user-1", "HISTORICAL_REPLAY", later.lastCompletedBar);
    expect(resolved.resolution?.detail).toBe("HIT_T1");
    expect(tracker.listOpen()).toHaveLength(0);
  });
});
