import { describe, expect, it } from "vitest";
import { AlpacaOptionsChainProvider, OptionsEntitlementError } from "../src/providers/alpaca.js";

describe("Alpaca options chain adapter", () => {
  it("maps snapshot payload into OptionContracts", async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response(
        JSON.stringify({
          snapshots: {
            AAPL261016C00225000: {
              greeks: { delta: 0.42 },
              latestQuote: { bp: 3.1, ap: 3.3 },
              latestTrade: { p: 3.2, s: 120 },
              openInterest: 1500,
            },
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );

    const provider = new AlpacaOptionsChainProvider({
      apiKeyId: "k",
      apiSecretKey: "s",
      fetchImpl,
      feed: "indicative",
    });

    const chain = await provider.getChain({
      underlying: "AAPL",
      side: "LONG",
      minDte: 1,
      maxDte: 60,
      asOf: new Date("2026-10-09T15:00:00Z"),
    });

    expect(chain.length).toBe(1);
    expect(chain[0]!.right).toBe("CALL");
    expect(chain[0]!.strike).toBe(225);
    expect(chain[0]!.delta).toBeCloseTo(0.42);
    expect(chain[0]!.spreadPct).toBeLessThan(10);
  });

  it("throws OptionsEntitlementError on 403", async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response("forbidden", { status: 403 });
    const provider = new AlpacaOptionsChainProvider({
      apiKeyId: "k",
      apiSecretKey: "s",
      fetchImpl,
    });
    await expect(
      provider.getChain({ underlying: "AAPL", side: "LONG" }),
    ).rejects.toBeInstanceOf(OptionsEntitlementError);
  });
});
