import { describe, expect, it } from "vitest";
import { loadConfirmationConfig } from "@wulu/domain";
import { buildBreakoutRetestConfirmations } from "../src/techniques/confirmations/breakoutRetestConfirmations.js";
import { buildLiquiditySweepConfirmations } from "../src/techniques/confirmations/liquiditySweepConfirmations.js";
import { buildOrbConfirmations } from "../src/techniques/confirmations/orbConfirmations.js";
import { buildVwapConfirmations } from "../src/techniques/confirmations/vwapConfirmations.js";

const config = loadConfirmationConfig();

function requiredIds(checks: { id: string; requiredForEntry: boolean }[]): string[] {
  return checks.filter((c) => c.requiredForEntry).map((c) => c.id);
}

describe("per-strategy confirmation specs", () => {
  it("breakout+retest requires RSI and VWAP", () => {
    const checks = buildBreakoutRetestConfirmations({
      side: "LONG",
      bars5m: [],
      bars1m: [],
      lastPrice: 100,
      level: 99,
      config,
      htf1h: "BULLISH",
      htf15m: "BULLISH",
      native1h: true,
      native15m: true,
      closes: Array.from({ length: 20 }, () => 100),
      breakVol: 1.2,
      entryForRr: 100,
      stop: 98,
      target1: 104,
      structure: {
        id: "STRUCTURE",
        status: "WAITING",
        reason: "test",
        requiredForEntry: true,
      },
    });
    const req = requiredIds(checks);
    expect(req).toContain("SECTOR_ALIGNMENT");
    expect(checks.map((c) => c.id)).toContain("HTF_1H");
    expect(checks.map((c) => c.id)).toContain("HTF_15M");
    expect(req).toContain("VWAP");
    expect(checks.some((c) => c.reason.includes("Breakout+Retest"))).toBe(true);
  });

  it("VWAP spec omits RSI and uses strategy VWAP hold row", () => {
    const checks = buildVwapConfirmations({
      side: "LONG",
      bars5m: [],
      lastPrice: 100,
      vwap: 99.5,
      config,
      htf1h: "RANGE",
      htf15m: "RANGE",
      native1h: true,
      native15m: true,
      entryForRr: 100,
      stop: 98,
      target1: 104,
      structure: {
        id: "STRUCTURE",
        status: "PASS",
        reason: "cross",
        requiredForEntry: true,
      },
      vwapHold: {
        id: "VWAP",
        status: "PASS",
        reason: "hold",
        requiredForEntry: true,
      },
    });
    expect(requiredIds(checks)).not.toContain("SECTOR_ALIGNMENT");
    expect(checks.filter((c) => c.id === "VWAP").length).toBe(1);
  });

  it("ORB spec skips RSI", () => {
    const checks = buildOrbConfirmations({
      side: "LONG",
      bars5m: [],
      bars1m: [],
      lastPrice: 100,
      trigger: 99,
      orbMinutes: 15,
      config,
      htf1h: "BULLISH",
      htf15m: "BULLISH",
      native1h: true,
      native15m: false,
      entryForRr: 100,
      stop: 97,
      target1: 105,
      structure: {
        id: "STRUCTURE",
        status: "WAITING",
        reason: "orb",
        requiredForEntry: true,
      },
    });
    expect(requiredIds(checks)).not.toContain("SECTOR_ALIGNMENT");
    expect(checks.some((c) => c.reason.includes("ORB"))).toBe(true);
  });

  it("liquidity sweep uses minimal gate set", () => {
    const checks = buildLiquiditySweepConfirmations({
      side: "SHORT",
      bars5m: [],
      lastPrice: 100,
      level: 101,
      config,
      entryForRr: 100,
      stop: 102,
      target1: 96,
      structure: {
        id: "STRUCTURE",
        status: "PASS",
        reason: "sweep",
        requiredForEntry: true,
      },
      htf1h: "BEARISH",
      htf15m: "BEARISH",
      native1h: false,
      native15m: false,
    });
    const ids = checks.map((c) => c.id);
    expect(ids).toContain("HTF_1H");
    expect(ids).toContain("HTF_15M");
    expect(ids).not.toContain("VWAP");
    expect(ids).not.toContain("SECTOR_ALIGNMENT");
  });
});
