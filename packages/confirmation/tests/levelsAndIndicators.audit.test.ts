import { describe, expect, it } from "vitest";
import { MockMarketDataProvider } from "@wulu/market-data";
import { rsi, ema } from "@wulu/strategies";
import { deriveLevels } from "../src/deriveLevels.js";
import { evaluateSetup } from "../src/evaluateSetup.js";

/** Friday RTH sample used across confirmation tests */
const RTH_NOW = new Date("2026-10-09T14:45:00Z");

describe("audit: levels + indicator helpers", () => {
  it("deriveLevels uses completed 5m bar structure (not invented flat prices)", async () => {
    const md = new MockMarketDataProvider({
      symbol: "NVDA",
      side: "LONG",
      basePrice: 100,
      aboveVwap: true,
      highVolume: true,
      staleMs: 3_000,
      now: RTH_NOW,
    });
    const snap = await md.getSnapshot("NVDA");
    const levels = deriveLevels(snap.bars5m, "LONG", snap.lastPrice);
    const completed = snap.bars5m.filter((b) => b.completed);
    const prior = completed.at(-2);
    expect(prior).toBeTruthy();
    expect(levels.trigger).toBe(prior!.high);
    expect(levels.stop).toBeLessThan(levels.trigger);
    expect(levels.target1).toBeGreaterThan(levels.trigger);
    expect(levels.target2).toBeGreaterThan(levels.target1);
  });

  it("VWAP and FIVE_MIN rows exist on matrix; RSI/EMA are not confirmation gates", async () => {
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
    const snap = await md.getSnapshot("NVDA");
    const card = evaluateSetup({
      symbol: "NVDA",
      side: "LONG",
      snapshot: snap,
      now: RTH_NOW,
      whyMoving: {
        whyMoving: "Fixture",
        catalystLabel: "TEST",
        newsAgeMinutes: 5,
        priceReaction: "CONFIRMING",
        hasVerifiedCatalyst: true,
      },
    });
    const ids = card.matrix.rows.map((r) => r.id);
    expect(ids).toContain("VWAP");
    expect(ids).toContain("RELATIVE_VOLUME");
    expect(ids).toContain("FIVE_MIN_CONFIRMATION");
    expect(ids).not.toContain("RSI");
    expect(ids).not.toContain("EMA");
  });

  it("strategy helpers expose RSI/EMA for matching — not as live confirmation matrix", () => {
    const closes = Array.from({ length: 40 }, (_, i) => 100 + Math.sin(i / 3) * 2);
    const r = rsi(closes, 14);
    const e = ema(closes, 20);
    expect(r == null || Number.isFinite(r)).toBe(true);
    expect(Array.isArray(e) && e.length === closes.length).toBe(true);
    expect(Number.isFinite(e[e.length - 1]!)).toBe(true);
  });
});
