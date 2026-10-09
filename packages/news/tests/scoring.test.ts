import { describe, expect, it } from "vitest";
import { buildCatalystEvents } from "../src/buildCatalystEvent.js";
import { assertNewsDoesNotGrantEntry } from "../src/catalystPriceAlignment.js";
import { normalizeNewsItem } from "../src/normalize.js";
import { scoreMarketReactionConfirmation } from "../src/scoring/marketReaction.js";
import { buildWhyMoving } from "../src/whyMoving.js";
import { NO_VERIFIED_CATALYST_MESSAGE } from "../src/types.js";

describe("news scoring", () => {
  it("returns separate scores with machine-readable reasons", () => {
    const item = normalizeNewsItem({
      id: "1",
      headline: "Acme raises guidance after earnings beat",
      tickers: ["ACME"],
      source: "Reuters",
      publishedAt: new Date(),
      provider: "mock",
      verified: true,
    });
    const [event] = buildCatalystEvents([item]);
    expect(event).toBeDefined();
    const s = event!.scores;
    expect(s.catalystImportance.score).toBeGreaterThan(50);
    expect(s.sourceReliability.reasons.length).toBeGreaterThan(0);
    expect(s.newsFreshness.reasons.length).toBeGreaterThan(0);
    expect(s.directionalSentiment.score).toBeGreaterThan(0);
    expect(s.directionalSentiment.reasons.some((r) => /not win probability/i.test(r))).toBe(
      true,
    );
  });

  it("marks bullish news + weak tape as CONFLICTING", () => {
    const { label, confirmation } = scoreMarketReactionConfirmation(50, {
      priceVsVwap: "BELOW",
      relativeVolume: "LOW",
      relativeStrength: "WEAK",
    });
    expect(label).toBe("CONFLICTING");
    expect(confirmation.score).toBeLessThan(50);
  });

  it("never invents a catalyst when none exists", () => {
    const why = buildWhyMoving(null);
    expect(why.whyMoving).toBe(NO_VERIFIED_CATALYST_MESSAGE);
    expect(why.hasVerifiedCatalyst).toBe(false);
  });

  it("forbids news layer from proposing ENTRY ACTIVE", () => {
    expect(() => assertNewsDoesNotGrantEntry("ENTRY_ACTIVE_LONG")).toThrow(/Forbidden/);
    expect(() => assertNewsDoesNotGrantEntry("NEAR_ACTIVE")).not.toThrow();
  });
});
