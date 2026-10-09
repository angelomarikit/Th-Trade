import { describe, expect, it } from "vitest";
import { MockMarketDataProvider } from "@wulu/market-data";
import { NO_VERIFIED_CATALYST_MESSAGE } from "@wulu/news";
import { evaluateSetup } from "../src/evaluateSetup.js";
import { evaluateFiveMinConfirmation } from "../src/fiveMinConfirmation.js";

/** Friday RTH in US Eastern (10:45 EDT) */
const RTH_NOW = new Date("2026-10-09T14:45:00Z");

describe("evaluateSetup", () => {
  it("marks NEAR ACTIVE when 5m bar is still forming during RTH", async () => {
    const md = new MockMarketDataProvider({
      symbol: "NVDA",
      side: "LONG",
      basePrice: 120,
      aboveVwap: true,
      highVolume: true,
      incompleteFiveMin: true,
      staleMs: 3_000,
      now: RTH_NOW,
    });
    const snapshot = await md.getSnapshot("NVDA");
    const card = evaluateSetup({
      symbol: "NVDA",
      side: "LONG",
      snapshot,
      now: RTH_NOW,
      whyMoving: {
        whyMoving: "Raised guidance after earnings",
        catalystLabel: "HIGH IMPACT BULLISH",
        newsAgeMinutes: 18,
        priceReaction: "CONFIRMING",
        hasVerifiedCatalyst: true,
      },
    });

    expect(card.session?.session).toBe("RTH");
    expect(card.session?.tightenConfirmation).toBe(true);
    expect(card.state).toBe("NEAR_ACTIVE");
    expect(card.statusLabel).toBe("NEAR ACTIVE");
    expect(card.conditionsPassed).toBeGreaterThanOrEqual(1);
    expect(card.nearActive.stillWaitingFor.length).toBeGreaterThan(0);
    expect(card.nearActive.active).toBe(true);
    expect(card.nearActive.permissionToEnter).toBe(false);
    expect(card.nearActive.confirmationRequirement).toMatch(/never entry permission/i);
    expect(card.nearActive.distanceLabel.length).toBeGreaterThan(0);
    expect(card.nearActive.setupQualityScore).toBe(card.setupScore.total);
    expect(card.nearActive.dataTimestamp).toBe(card.evaluatedAt);
    expect(
      card.matrix.rows.find((r) => r.id === "FIVE_MIN_CONFIRMATION")?.status,
    ).toBe("WAITING");
    expect(card.setupScore.disclaimer).toMatch(/NOT WIN PROBABILITY/);
    expect(card.regime).toBeNull();
    expect(card.historicalEdge).toBeNull();
    expect(card.matchedStrategies).toEqual([]);
    expect(card.options).toBeNull();
    expect(card.relativeMomentum).toBeNull();
  });

  it("fail-closes to DATA_NOT_VERIFIED on stale quotes", async () => {
    const md = new MockMarketDataProvider({
      symbol: "NVDA",
      side: "LONG",
      basePrice: 120,
      staleMs: 5 * 60_000,
      now: RTH_NOW,
    });
    const snapshot = await md.getSnapshot("NVDA");
    const card = evaluateSetup({
      symbol: "NVDA",
      side: "LONG",
      snapshot,
      now: RTH_NOW,
      whyMoving: {
        whyMoving: NO_VERIFIED_CATALYST_MESSAGE,
        catalystLabel: null,
        newsAgeMinutes: null,
        priceReaction: null,
        hasVerifiedCatalyst: false,
      },
    });
    expect(card.state).toBe("DATA_NOT_VERIFIED");
  });

  it("does not treat trigger touch on forming bar as confirmation", async () => {
    const md = new MockMarketDataProvider({
      symbol: "TEST",
      side: "LONG",
      basePrice: 100,
      incompleteFiveMin: true,
      aboveVwap: true,
      highVolume: true,
      now: RTH_NOW,
    });
    const snapshot = await md.getSnapshot("TEST");
    const forming = snapshot.bars5m.at(-1)!;
    const trigger = forming.low - 1;
    const result = evaluateFiveMinConfirmation(snapshot.bars5m, "LONG", trigger);
    expect(result.pass).toBe(false);
    expect(result.waiting).toBe(true);
    expect(result.reason).toMatch(/not an entry|Waiting for completed/i);
  });
});
