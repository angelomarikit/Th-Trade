import { describe, expect, it } from "vitest";
import { NewsService } from "../src/NewsService.js";
import { MockNewsProvider } from "../src/providers/mock.js";

describe("NewsService", () => {
  it("returns WHY MOVING for NVDA from clustered mock news", async () => {
    const svc = new NewsService({ provider: new MockNewsProvider() });
    const { event, why } = await svc.getCatalystForTicker("NVDA", {
      priceVsVwap: "ABOVE",
      relativeVolume: "HIGH",
      relativeStrength: "STRONG",
    });

    expect(event).not.toBeNull();
    expect(event!.memberCount).toBeGreaterThanOrEqual(4);
    expect(why.hasVerifiedCatalyst).toBe(true);
    expect(why.whyMoving.toLowerCase()).toContain("guidance");
    expect(why.priceReaction).toBe("CONFIRMING");
    expect(event!.scores.marketReactionConfirmation.score).toBeGreaterThan(50);
  });

  it("returns no-catalyst message for unknown ticker", async () => {
    const svc = new NewsService({ provider: new MockNewsProvider() });
    const { event, why } = await svc.getCatalystForTicker("ZZZZ");
    expect(event).toBeNull();
    expect(why.whyMoving).toBe("NO VERIFIED NEWS CATALYST FOUND");
  });
});
