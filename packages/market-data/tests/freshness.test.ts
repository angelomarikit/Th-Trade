import { describe, expect, it } from "vitest";
import { assessFreshness, barEffectiveEndTime, resolveMarketDataTimestamp } from "../src/freshness.js";
import { classifyUsEquitySession } from "../src/session.js";
import type { Bar, MarketSnapshot } from "../src/types.js";

describe("assessFreshness bar timing", () => {
  it("uses 1m bar end time so RTH snapshot is not falsely stale", () => {
    const now = new Date("2026-10-09T14:45:30Z"); // 10:45:30 ET RTH
    const session = classifyUsEquitySession(now);
    const barOpen = new Date("2026-10-09T14:45:00Z"); // 10:45 ET open
    const bar: Bar = {
      symbol: "SPY",
      timeframe: "1Min",
      timestamp: barOpen,
      open: 1,
      high: 1,
      low: 1,
      close: 1,
      volume: 1,
      completed: false,
    };
    expect(barEffectiveEndTime(bar).getTime()).toBe(barOpen.getTime() + 60_000);

    const snap: MarketSnapshot = {
      symbol: "SPY",
      lastPrice: 500,
      quote: null,
      bars1m: [bar],
      bars5m: [],
      receivedAt: now,
      marketTimestamp: barOpen,
    };
    const resolved = resolveMarketDataTimestamp(snap);
    expect(resolved?.getTime()).toBe(barOpen.getTime() + 60_000);

    const fresh = assessFreshness(snap, now, 90_000, session);
    expect(fresh.ok).toBe(true);
  });
});
