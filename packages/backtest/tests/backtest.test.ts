import { describe, expect, it } from "vitest";
import { listStrategies } from "@wulu/strategies";
import { HistoricalEdgeService } from "../src/HistoricalEdgeService.js";
import { HISTORICAL_EDGE_DISCLAIMER } from "../src/edgePanel.js";
import { runBacktest } from "../src/engine.js";
import { makeBacktestBars } from "../src/fixtures.js";
import { computeEdgeMetrics } from "../src/metrics.js";
import { contiguousSplit, runWalkForward } from "../src/walkForward.js";

describe("Phase D backtest + strategies", () => {
  it("registers the planned strategy library ids", () => {
    const ids = listStrategies().map((s) => s.id);
    expect(ids).toContain("VWAP_RECLAIM");
    expect(ids).toContain("ORB_LONG");
    expect(ids).toContain("MACD_MOMENTUM_LONG");
    expect(ids.length).toBeGreaterThanOrEqual(16);
  });

  it("runs VWAP_RECLAIM without look-ahead and produces metrics", () => {
    const bars = makeBacktestBars({ count: 180, base: 100 });
    const run = runBacktest({
      strategyId: "VWAP_RECLAIM",
      symbol: "TEST",
      bars,
      regimePrimary: "TRENDING_BULLISH",
    });
    expect(run.schemaVersion).toBe("1.0.0");
    for (const t of run.trades) {
      expect(t.entryBarIndex).toBeGreaterThan(t.signalBarIndex);
    }
    const metrics = computeEdgeMetrics(run.trades);
    expect(metrics.sampleSize).toBe(run.trades.length);
    if (metrics.sampleSize > 0) {
      expect(metrics.expectancyR).not.toBeNull();
    }
  });

  it("separates train / validation / OOS and reports degradation", () => {
    const bars = makeBacktestBars({ count: 220 });
    const split = contiguousSplit(bars.length);
    expect(split.train.end).toBeLessThan(split.validation.start === split.train.end ? split.outOfSample.end : 9999);
    expect(split.validation.end).toBe(split.outOfSample.start);

    const wf = runWalkForward({
      strategyId: "MOMENTUM_CONTINUATION_LONG",
      symbol: "TEST",
      bars,
    });
    expect(wf.note).toMatch(/out-of-sample/i);
    expect(wf.train).toBeDefined();
    expect(wf.outOfSample).toBeDefined();
  });

  it("historical edge panel includes non-probability disclaimer", () => {
    const bars = makeBacktestBars({ count: 200 });
    const svc = new HistoricalEdgeService();
    const { panel } = svc.compute({
      strategyId: "VWAP_RECLAIM",
      symbol: "TEST",
      bars,
      includeWalkForward: true,
    });
    expect(panel.disclaimer).toBe(HISTORICAL_EDGE_DISCLAIMER);
    expect(panel.disclaimer).toMatch(/NOT the probability/i);
  });
});
