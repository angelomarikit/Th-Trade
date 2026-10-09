import { describe, expect, it } from "vitest";
import { OptionsEngine, formatBestContractCard } from "../src/OptionsEngine.js";
import { MockOptionsChainProvider } from "../src/providers/mock.js";
import { pickBestContract } from "../src/ranker.js";

describe("Phase F options architecture", () => {
  it("stays inactive when feature flag is off", async () => {
    const engine = new OptionsEngine(new MockOptionsChainProvider(100));
    const result = await engine.evaluate({
      enabled: false,
      underlyingState: "ENTRY_ACTIVE_LONG",
      side: "LONG",
      underlying: "TEST",
    });
    expect(result.enabled).toBe(false);
    expect(result.eligible).toBe(false);
    expect(result.best).toBeNull();
    expect(result.automaticOrders).toBe(false);
  });

  it("requires underlying ENTRY ACTIVE before ranking", async () => {
    const engine = new OptionsEngine(new MockOptionsChainProvider(100));
    const result = await engine.evaluate({
      enabled: true,
      underlyingState: "NEAR_ACTIVE",
      side: "LONG",
      underlying: "TEST",
    });
    expect(result.eligible).toBe(false);
    expect(result.reason).toMatch(/ENTRY ACTIVE first/i);
    expect(result.best).toBeNull();
  });

  it("ranks a CALL candidate for ENTRY ACTIVE LONG without placing orders", async () => {
    const provider = new MockOptionsChainProvider(100);
    const engine = new OptionsEngine(provider);
    const result = await engine.evaluate({
      enabled: true,
      underlyingState: "ENTRY_ACTIVE_LONG",
      side: "LONG",
      underlying: "TEST",
    });

    expect(result.eligible).toBe(true);
    expect(result.direction).toBe("CALL");
    expect(result.best).not.toBeNull();
    expect(result.best!.contract.right).toBe("CALL");
    expect(result.best!.whyThisContract.length).toBeGreaterThan(0);
    expect(result.automaticOrders).toBe(false);

    const card = formatBestContractCard(result);
    expect(card).toMatch(/BEST CONTRACT CANDIDATE/);
    expect(card).toMatch(/NO AUTOMATIC ORDER EXECUTION/);
  });

  it("rejects wide-spread / illiquid contracts", async () => {
    const provider = new MockOptionsChainProvider(100);
    const chain = await provider.getChain({
      underlying: "TEST",
      side: "LONG",
      minDte: 3,
      maxDte: 45,
    });
    // Poison one contract
    chain[0]!.spreadPct = 40;
    chain[0]!.volume = 0;
    chain[0]!.openInterest = 0;

    const { ranked } = pickBestContract(chain, "CALL");
    const poisoned = ranked.find((r) => r.contract.symbol === chain[0]!.symbol);
    expect(poisoned?.score).toBe(-1);
    expect(poisoned?.rejectReasons.length).toBeGreaterThan(0);
  });
});
