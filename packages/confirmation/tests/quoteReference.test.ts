import { describe, expect, it } from "vitest";
import { MockMarketDataProvider } from "@wulu/market-data";
import { deriveTradingAction } from "../src/tradingAction.js";
import { evaluateSetup } from "../src/evaluateSetup.js";

const RTH_NOW = new Date("2026-10-09T14:45:00Z");

describe("reference bar price vs live entry", () => {
  it("blocks verified entry when RTH quote spread is too wide", async () => {
    const md = new MockMarketDataProvider({
      symbol: "TSLA",
      side: "LONG",
      basePrice: 360,
      spreadPct: 5,
      staleMs: 1_000,
      now: RTH_NOW,
    });
    const snapshot = await md.getSnapshot("TSLA");
    const card = evaluateSetup({
      symbol: "TSLA",
      side: "LONG",
      snapshot,
      now: RTH_NOW,
      whyMoving: {
        whyMoving: "test",
        catalystLabel: null,
        newsAgeMinutes: null,
        priceReaction: null,
        hasVerifiedCatalyst: false,
      },
    });
    expect(card.dataFresh).toBe(false);
    expect(card.quoteTransparency?.referencePriceOnly).toBe(true);
    expect(card.quoteTransparency?.priceBasis).toMatch(/Historical reference/i);
    expect(
      deriveTradingAction({
        state: card.state,
        statusLabel: card.statusLabel,
        userStatus: card.statusLabel,
        dataFresh: card.dataFresh,
        entryExecutable: card.entryZone.executable,
      }),
    ).toBe("WAIT");
  });
});
