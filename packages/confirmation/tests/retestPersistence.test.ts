import { describe, expect, it } from "vitest";
import type { Bar } from "@wulu/market-data";
import { evaluateRetest, failedHoldBar } from "../src/retest.js";

function bar(iso: string, o: number, h: number, l: number, c: number): Bar {
  return {
    symbol: "TSLA",
    timeframe: "5Min",
    timestamp: new Date(iso),
    open: o,
    high: h,
    low: l,
    close: c,
    volume: 1_000_000,
    completed: true,
  };
}

describe("evaluateRetest persistence", () => {
  it("detects failed break from bar history without prior phase (TSLA-style wick)", () => {
    const level = 396;
    const bars: Bar[] = [];
    for (let i = 0; i < 14; i++) {
      bars.push(
        bar(
          `2026-10-26T14:${String(i).padStart(2, "0")}:00.000Z`,
          390 + i * 0.2,
          391 + i * 0.2,
          389,
          390.5 + i * 0.15,
        ),
      );
    }
    bars.push(bar("2026-10-26T14:13:00.000Z", 394, 397, 393.5, 396.4));
    bars.push(bar("2026-10-26T14:14:00.000Z", 395, 396.65, 394.5, 395.45));

    expect(failedHoldBar("LONG", bars.at(-1)!, level)).toBe(true);

    const r1 = evaluateRetest({
      side: "LONG",
      level,
      preferRetestModel: true,
      bars5m: bars,
    });
    expect(r1.phase).toBe("RETEST_FAILED");
    expect(r1.reason).toMatch(/Failed break/i);

    const r2 = evaluateRetest({
      side: "LONG",
      level,
      preferRetestModel: true,
      previousPhase: "RETEST_FAILED",
      bars5m: bars,
    });
    expect(r2.phase).toBe("RETEST_FAILED");
    expect(r2.reason).toMatch(/sticky/i);
  });

  it("advances WAITING_RETEST across polls when phase is persisted", () => {
    const level = 100;
    const base = [
      bar("2026-10-09T14:00:00Z", 99, 99.5, 98.5, 99.2),
      bar("2026-10-09T14:05:00Z", 99.2, 101, 99, 100.8),
    ];
    const r1 = evaluateRetest({
      side: "LONG",
      level,
      preferRetestModel: true,
      previousPhase: "NONE",
      bars5m: base,
    });
    expect(r1.phase).toBe("WAITING_RETEST");

    const withRetest = [
      ...base,
      bar("2026-10-09T14:10:00Z", 100.5, 100.7, 99.9, 100.2),
    ];
    const r2 = evaluateRetest({
      side: "LONG",
      level,
      preferRetestModel: true,
      previousPhase: r1.phase,
      bars5m: withRetest,
    });
    expect(["RETEST_HELD", "RETESTING"]).toContain(r2.phase);
  });
});
