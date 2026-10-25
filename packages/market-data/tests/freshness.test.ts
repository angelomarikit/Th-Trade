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

  it("honors explicit maxAgeMs on weekend when lab preview override is passed", () => {
    const now = new Date("2026-10-25T12:00:00Z"); // Sun ~08:00 ET
    const session = classifyUsEquitySession(now);
    expect(session.session).toBe("WEEKEND");
    const friClose = new Date("2026-10-24T20:00:00Z"); // Fri 16:00 ET bar end approx
    const bar: Bar = {
      symbol: "NVDA",
      timeframe: "5Min",
      timestamp: new Date(friClose.getTime() - 300_000),
      open: 1,
      high: 1,
      low: 1,
      close: 1,
      volume: 1,
      completed: true,
    };
    const snap: MarketSnapshot = {
      symbol: "NVDA",
      lastPrice: 211,
      quote: null,
      bars1m: [],
      bars5m: [bar],
      receivedAt: now,
      marketTimestamp: friClose,
    };
    expect(assessFreshness(snap, now, 90_000, session).ok).toBe(false);
    const lab = assessFreshness(snap, now, 96 * 60 * 60 * 1000, session);
    expect(lab.ok).toBe(true);
    expect(lab.maxAgeMs).toBe(96 * 60 * 60 * 1000);
  });
});
