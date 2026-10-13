import { describe, expect, it } from "vitest";
import { aggregateMeasuredPerformance } from "../src/measuredPerformance.js";

describe("aggregateMeasuredPerformance", () => {
  it("withholds win rate below min sample", () => {
    const report = aggregateMeasuredPerformance(
      [
        { symbol: "A", outcomeStatus: "WIN", outcomeR: 1, source: "LIVE" },
        { symbol: "A", outcomeStatus: "LOSS", outcomeR: -1, source: "LIVE" },
      ],
      { minSampleForRate: 20 },
    );
    expect(report.overall.winRatePct).toBeNull();
    expect(report.overall.wins).toBe(1);
    expect(report.overall.note.toLowerCase()).toContain("withheld");
    expect(report.automaticOrders).toBe(false);
  });

  it("computes win rate when sample is enough and separates sources", () => {
    const rows = Array.from({ length: 12 }, (_, i) => ({
      symbol: "NVDA",
      side: "LONG",
      strategyType: "SCANNER",
      outcomeStatus: i % 3 === 0 ? ("LOSS" as const) : ("WIN" as const),
      outcomeR: i % 3 === 0 ? -1 : 1.5,
      source: "HISTORICAL_REPLAY",
      liveValidated: false,
    }));
    const replay = aggregateMeasuredPerformance(rows, {
      source: "HISTORICAL_REPLAY",
      minSampleForRate: 10,
    });
    expect(replay.overall.winRatePct).toBeCloseTo((8 / 12) * 100, 5);
    expect(replay.bySymbol[0]?.key).toBe("NVDA");

    const liveOnly = aggregateMeasuredPerformance(rows, { source: "LIVE", minSampleForRate: 10 });
    expect(liveOnly.overall.sampleSize).toBe(0);
  });

  it("LIVE_VALIDATED only includes liveValidated LIVE rows", () => {
    const rows = [
      {
        symbol: "A",
        outcomeStatus: "WIN" as const,
        outcomeR: 1,
        source: "LIVE",
        liveValidated: true,
      },
      {
        symbol: "B",
        outcomeStatus: "WIN" as const,
        outcomeR: 1,
        source: "LIVE",
        liveValidated: false,
      },
      {
        symbol: "C",
        outcomeStatus: "WIN" as const,
        outcomeR: 1,
        source: "HISTORICAL_REPLAY",
        liveValidated: true,
      },
    ];
    const report = aggregateMeasuredPerformance(rows, {
      source: "LIVE_VALIDATED",
      minSampleForRate: 1,
    });
    expect(report.overall.sampleSize).toBe(1);
    expect(report.overall.wins).toBe(1);
  });
});
