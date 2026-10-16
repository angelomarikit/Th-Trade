import { describe, expect, it } from "vitest";
import { evaluateLiquidity, LIQUIDITY_SANITY_SPREAD_PCT } from "../src/liquidity.js";

describe("evaluateLiquidity spread sanity", () => {
  it("fails closed on absurd after-hours style spreads with bid/ask in reason", () => {
    const r = evaluateLiquidity({
      symbol: "TSLA",
      bid: 330,
      ask: 390,
      timestamp: new Date("2026-10-15T22:00:00Z"),
    });
    expect(r.fail).toBe(true);
    expect(r.spreadPct).not.toBeNull();
    expect(r.spreadPct!).toBeGreaterThan(LIQUIDITY_SANITY_SPREAD_PCT);
    expect(r.reason).toMatch(/bid 330/i);
    expect(r.reason).toMatch(/ask 390/i);
  });
});
