import { describe, expect, it } from "vitest";
import {
  classifyUsEquitySession,
  confirmationProfileForSession,
} from "../src/session.js";
import { assessFreshness } from "../src/freshness.js";
import type { MarketSnapshot } from "../src/types.js";

describe("US equity session + RTH tightening", () => {
  it("classifies weekday 10:45 ET as RTH with tightened profile", () => {
    // 2026-10-09 14:45 UTC = 10:45 EDT
    const now = new Date("2026-10-09T14:45:00Z");
    const s = classifyUsEquitySession(now);
    expect(s.session).toBe("RTH");
    expect(s.tightenConfirmation).toBe(true);
    expect(s.maxDataAgeMs).toBe(45_000);

    const profile = confirmationProfileForSession(s);
    expect(profile.minRelativeVolume).toBe(1.5);
    expect(profile.maxSpreadPct).toBe(0.2);
    expect(profile.requireRegimeAlignmentForEntry).toBe(true);
    expect(profile.minRewardToRisk).toBe(1.8);
  });

  it("fail-closes when session is weekend", () => {
    const now = new Date("2026-10-10T15:00:00Z"); // Saturday
    const s = classifyUsEquitySession(now);
    expect(s.session).toBe("WEEKEND");
    expect(s.maxDataAgeMs).toBe(0);

    const snap: MarketSnapshot = {
      symbol: "SPY",
      lastPrice: 500,
      quote: {
        symbol: "SPY",
        bid: 499.9,
        ask: 500.1,
        timestamp: now,
      },
      bars1m: [],
      bars5m: [],
      receivedAt: now,
      marketTimestamp: now,
    };
    const fresh = assessFreshness(snap, now, 45_000, s);
    expect(fresh.ok).toBe(false);
    expect(fresh.reason).toMatch(/DATA NOT VERIFIED/);
  });
});
