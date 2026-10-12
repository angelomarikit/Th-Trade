import { describe, expect, it } from "vitest";
import { SignalPersistGate } from "../src/signalPersistGate.js";
import type { LiveSetupCard } from "../src/liveCard.js";

function card(partial: Partial<LiveSetupCard> & { state: string; setupId: string }): LiveSetupCard {
  return {
    symbol: "SPY",
    side: "LONG",
    evaluatedAt: new Date().toISOString(),
    lastCompletedBar: { asOf: "2026-10-12T18:00:00Z", open: 1, high: 1, low: 1, close: 1, volume: 1, completed: true },
    ...partial,
  } as LiveSetupCard;
}

describe("SignalPersistGate", () => {
  it("persists first sighting and state transitions only", () => {
    const gate = new SignalPersistGate();
    const a = card({ state: "NO_TRADE", setupId: "SPY:LONG:100" });
    expect(gate.shouldPersist(a, null)).toBe(true);
    expect(gate.shouldPersist({ ...a, evaluatedAt: "t2" }, null)).toBe(false);
    expect(gate.shouldPersist({ ...a, state: "WAIT", evaluatedAt: "t3" }, null)).toBe(true);
    expect(gate.shouldPersist({ ...a, state: "WAIT", evaluatedAt: "t4" }, null)).toBe(false);
  });

  it("persists when completed 5m bar advances while WAIT", () => {
    const gate = new SignalPersistGate();
    const a = card({
      state: "WAIT",
      setupId: "QQQ:LONG:200",
      lastCompletedBar: {
        asOf: "2026-10-12T18:00:00Z",
        open: 1,
        high: 1,
        low: 1,
        close: 1,
        volume: 1,
        completed: true,
      },
    });
    expect(gate.shouldPersist(a, "u1")).toBe(true);
    expect(
      gate.shouldPersist(
        {
          ...a,
          lastCompletedBar: {
            asOf: "2026-10-12T18:05:00Z",
            open: 1,
            high: 1,
            low: 1,
            close: 1,
            volume: 1,
            completed: true,
          },
        },
        "u1",
      ),
    ).toBe(true);
  });
});
