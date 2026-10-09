import { describe, expect, it } from "vitest";
import { AlpacaNewsProvider } from "../src/providers/alpaca.js";

describe("AlpacaNewsProvider", () => {
  it("maps official API payload into normalized NewsItems", async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response(
        JSON.stringify({
          news: [
            {
              id: 99,
              headline: "Example Corp announces partnership",
              summary: "Strategic partnership disclosed.",
              created_at: "2026-10-09T01:00:00Z",
              url: "https://example.test/a",
              symbols: ["EXAM"],
              source: "benzinga",
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );

    const provider = new AlpacaNewsProvider({
      apiKeyId: "key",
      apiSecretKey: "secret",
      fetchImpl,
    });

    const items = await provider.fetchNews({ tickers: ["EXAM"] });
    expect(items).toHaveLength(1);
    expect(items[0]!.tickers).toEqual(["EXAM"]);
    expect(items[0]!.provider).toBe("alpaca");
    expect(items[0]!.category).toBe("PARTNERSHIP");
    expect(items[0]!.verified).toBe(true);
  });

  it("requires credentials", () => {
    expect(
      () =>
        new AlpacaNewsProvider({
          apiKeyId: "",
          apiSecretKey: "",
        }),
    ).toThrow(/requires ALPACA/);
  });
});
