import { describe, expect, it, vi, afterEach } from "vitest";
import type { LiveSetupCard } from "@wulu/confirmation";
import { MonitorLimitError, WatchMonitor } from "../src/WatchMonitor.js";
import type { SetupScanner } from "../src/SetupScanner.js";

function fakeCard(symbol: string, score = 50): LiveSetupCard {
  return {
    symbol,
    side: "LONG",
    state: "WAIT",
    statusLabel: "WAIT",
    whyMoving: {
      whyMoving: "test",
      catalystLabel: null,
      newsAgeMinutes: null,
      priceReaction: null,
      hasVerifiedCatalyst: false,
    },
    conditionsPassed: 2,
    conditionsTotal: 10,
    matrix: { rows: [], passed: 2, total: 10, allRequiredPassed: false, waitingFor: [] },
    nearActive: {
      active: false,
      conditionsPassed: 2,
      conditionsTotal: 10,
      trigger: 100,
      distanceToTriggerAbs: -1,
      distanceToTriggerPct: -1,
      distanceLabel: "1% BELOW TRIGGER",
      stillWaitingFor: ["Waiting for volume"],
      statusLabel: "WAIT",
      confirmationRequirement: "test",
      permissionToEnter: false,
      dataTimestamp: new Date().toISOString(),
      setupQualityScore: score,
    },
    alertAt: 100,
    entryZone: { low: 100, high: 101, executable: false },
    stop: 99,
    target1: 103,
    target2: 105,
    setupScore: { total: score, breakdown: {}, disclaimer: "NOT WIN PROBABILITY" },
    lastPrice: 99,
    rewardToRisk: 1.8,
    dataFresh: true,
    evaluatedAt: new Date().toISOString(),
    session: {
      session: "RTH",
      etLabel: "test",
      tightenConfirmation: true,
      reason: "test",
    },
    regime: null,
    historicalEdge: null,
    matchedStrategies: [],
    options: null,
    relativeMomentum: {
      feed: "iex",
      feedLimitation: "test",
      symbolIntradayPct: 0,
      spyIntradayPct: 0,
      qqqIntradayPct: null,
      sectorEtf: "XLK",
      sectorIntradayPct: null,
      vsSpyPct: 0.1,
      vsQqqPct: null,
      vsSectorPct: null,
      gapPct: null,
      rvol: 1,
      vwapLocation: "ABOVE",
      intradayTrend: "RANGE",
      rankScore: 55,
      notes: [],
    },
  } as unknown as LiveSetupCard;
}

describe("WatchMonitor", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("enforces max 6 symbols and scans each on tick", async () => {
    const scan = vi.fn(async ({ symbol }: { symbol: string }) => fakeCard(symbol));
    const scanner = { scan } as unknown as SetupScanner;
    const mon = new WatchMonitor(scanner, "test", { maxSymbols: 6, intervalMs: 60_000 });

    mon.setWatchlist([
      { symbol: "TSLA", side: "LONG" },
      { symbol: "MU", side: "LONG" },
      { symbol: "NVDA", side: "LONG" },
      { symbol: "AMD", side: "LONG" },
      { symbol: "SPY", side: "LONG" },
      { symbol: "QQQ", side: "LONG" },
      { symbol: "AAPL", side: "LONG" }, // truncated
    ]);

    expect(mon.list()).toHaveLength(6);
    expect(mon.list().map((s) => s.symbol)).not.toContain("AAPL");

    await mon.tick();
    expect(scan).toHaveBeenCalledTimes(6);

    const snap = mon.snapshot();
    expect(snap.running).toBe(true);
    expect(snap.states).toHaveLength(6);
    expect(snap.ranked.length).toBe(6);

    expect(() => mon.add("AAPL")).toThrow(MonitorLimitError);
    mon.stop();
  });

  it("removes symbols and stops when empty", async () => {
    const scan = vi.fn(async ({ symbol }: { symbol: string }) => fakeCard(symbol));
    const scanner = { scan } as unknown as SetupScanner;
    const mon = new WatchMonitor(scanner, "desk", { maxSymbols: 6, intervalMs: 60_000 });
    mon.setWatchlist([{ symbol: "NVDA", side: "LONG" }]);
    await mon.tick();
    mon.remove("NVDA");
    expect(mon.list()).toHaveLength(0);
    expect(mon.running).toBe(false);
  });
});
