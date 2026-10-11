import { describe, expect, it } from "vitest";
import type { Bar } from "@wulu/market-data";
import { analyzeBreakout } from "../src/breakoutAnalysis.js";
import { detectFakeBreakoutRisk } from "../src/fakeBreakout.js";
import { evaluateFiveMinConfirmation } from "../src/fiveMinConfirmation.js";
import { evaluateRetest } from "../src/retest.js";
import { runSignalReplay } from "../src/signalReplay.js";
import { EXECUTION_POLICY } from "@wulu/market-data";

function bar(
  t: string,
  o: number,
  h: number,
  l: number,
  c: number,
  v = 10_000,
  completed = true,
): Bar {
  return {
    symbol: "TEST",
    timeframe: "5Min",
    timestamp: new Date(t),
    open: o,
    high: h,
    low: l,
    close: c,
    volume: v,
    vwap: (h + l + c) / 3,
    completed,
  };
}

describe("Phase 3 signal intelligence", () => {
  it("does not confirm breakout on forming candle touch", () => {
    const bars = [
      bar("2026-10-09T14:00:00Z", 100, 101, 99.5, 100.5),
      bar("2026-10-09T14:05:00Z", 100.5, 102.2, 100.4, 101.8, 12_000, false),
    ];
    const five = evaluateFiveMinConfirmation(bars, "LONG", 102);
    expect(five.pass).toBe(false);
    expect(five.waiting).toBe(true);
    expect(five.reason).toMatch(/forming bar|Waiting/);
  });

  it("confirms LONG breakout only on completed close beyond trigger", () => {
    const bars = [
      bar("2026-10-09T14:00:00Z", 100, 101, 99.5, 100.5),
      bar("2026-10-09T14:05:00Z", 100.5, 102.5, 100.4, 102.3),
    ];
    const br = analyzeBreakout({ side: "LONG", bars5m: bars, trigger: 102 });
    expect(br.mode).toBe("CONFIRMED_CLOSE");
    expect(br.closedBeyondLevel).toBe(true);
    const five = evaluateFiveMinConfirmation(bars, "LONG", 102);
    expect(five.pass).toBe(true);
  });

  it("detects bull trap when close fails back below trigger", () => {
    const bars = [
      bar("2026-10-09T14:00:00Z", 100, 101.5, 99.8, 101),
      bar("2026-10-09T14:05:00Z", 101, 103, 100.5, 101.2), // high above 102, close back below
    ];
    const warnings = detectFakeBreakoutRisk({
      side: "LONG",
      bars5m: bars,
      trigger: 102,
      rvol: 0.8,
      minRvol: 1.2,
    });
    expect(warnings.some((w) => w.pattern === "BULL_TRAP")).toBe(true);
    expect(warnings.some((w) => w.pattern === "LOW_VOLUME_BREAKOUT")).toBe(true);
  });

  it("detects bear trap reclaim", () => {
    const bars = [
      bar("2026-10-09T14:00:00Z", 100, 100.5, 98.5, 99),
      bar("2026-10-09T14:05:00Z", 99, 99.8, 97.5, 99.4), // low below 98, close back above
    ];
    const warnings = detectFakeBreakoutRisk({
      side: "SHORT",
      bars5m: bars,
      trigger: 98,
      rvol: 1.5,
    });
    expect(warnings.some((w) => w.pattern === "BEAR_TRAP")).toBe(true);
  });

  it("tracks break-and-retest phases without look-ahead", () => {
    const level = 100;
    const broke = evaluateRetest({
      side: "LONG",
      level,
      preferRetestModel: true,
      previousPhase: "NONE",
      bars5m: [
        bar("2026-10-09T14:00:00Z", 99, 99.5, 98.5, 99.2),
        bar("2026-10-09T14:05:00Z", 99.2, 101, 99, 100.8),
      ],
    });
    expect(broke.phase).toBe("WAITING_RETEST");

    const held = evaluateRetest({
      side: "LONG",
      level,
      preferRetestModel: true,
      previousPhase: "WAITING_RETEST",
      bars5m: [
        bar("2026-10-09T14:00:00Z", 99, 99.5, 98.5, 99.2),
        bar("2026-10-09T14:05:00Z", 99.2, 101, 99, 100.8),
        bar("2026-10-09T14:10:00Z", 100.5, 100.7, 99.9, 100.2),
      ],
    });
    expect(["RETEST_HELD", "RETESTING", "WAITING_RETEST"]).toContain(held.phase);
  });

  it("replay is deterministic and labeled not live", () => {
    const bars = Array.from({ length: 20 }, (_, i) => {
      const base = 100 + i * 0.1;
      return bar(
        new Date(Date.UTC(2026, 9, 9, 14, i * 5)).toISOString(),
        base,
        base + 0.8,
        base - 0.5,
        base + 0.3,
      );
    });
    const a = runSignalReplay({ symbol: "NVDA", side: "LONG", bars5m: bars });
    const b = runSignalReplay({ symbol: "NVDA", side: "LONG", bars5m: bars });
    expect(a.label).toBe("HISTORICAL REPLAY — NOT LIVE");
    expect(a.steps.length).toBe(b.steps.length);
    expect(a.steps.map((s) => s.card.state)).toEqual(b.steps.map((s) => s.card.state));
    expect(a.steps.every((s) => s.label === "HISTORICAL REPLAY — NOT LIVE")).toBe(true);
  });

  it("keeps automatic trading disabled", () => {
    expect(EXECUTION_POLICY.automaticOrders).toBe(false);
  });
});
