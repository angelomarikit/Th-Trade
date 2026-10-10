import { describe, expect, it, vi, afterEach } from "vitest";
import type { LiveSetupCard } from "@wulu/confirmation";
import {
  DEFAULT_MONITOR_WATCHLIST,
  MemoryAlertEventStore,
  MonitorHub,
  MonitorLimitError,
  WatchMonitor,
  isAlertWorthyTransition,
  toUserFacingStatus,
} from "../src/index.js";
import type { SetupScanner } from "../src/SetupScanner.js";
import { EXECUTION_POLICY } from "@wulu/market-data";

function fakeCard(
  symbol: string,
  opts?: {
    score?: number;
    statusLabel?: string;
    state?: string;
    nearActive?: boolean;
    dataFresh?: boolean;
    fiveMin?: string;
    rvol?: number;
  },
): LiveSetupCard {
  const score = opts?.score ?? 50;
  return {
    symbol,
    side: "LONG",
    state: (opts?.state ?? "WAIT") as LiveSetupCard["state"],
    statusLabel: opts?.statusLabel ?? "WAIT",
    whyMoving: {
      whyMoving: "test",
      catalystLabel: null,
      newsAgeMinutes: null,
      priceReaction: null,
      hasVerifiedCatalyst: false,
    },
    conditionsPassed: 2,
    conditionsTotal: 10,
    matrix: {
      rows: [
        { id: "VWAP", label: "VWAP", status: "WAITING", reason: "x", requiredForEntry: true },
        {
          id: "FIVE_MIN_CONFIRMATION",
          label: "5m",
          status: opts?.fiveMin ?? "WAITING",
          reason: "x",
          requiredForEntry: true,
        },
        {
          id: "RELATIVE_VOLUME",
          label: "RVOL",
          status: "WAITING",
          reason: "x",
          requiredForEntry: true,
        },
      ],
      passed: 2,
      total: 10,
      allRequiredPassed: false,
      waitingFor: [],
    },
    nearActive: {
      active: opts?.nearActive ?? false,
      conditionsPassed: 2,
      conditionsTotal: 10,
      trigger: 100,
      distanceToTriggerAbs: -1,
      distanceToTriggerPct: -0.4,
      distanceLabel: "0.4% BELOW TRIGGER",
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
    dataFresh: opts?.dataFresh ?? true,
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
      feedLimitation: "IEX subset — not consolidated volume",
      symbolIntradayPct: 1.2,
      spyIntradayPct: 0,
      qqqIntradayPct: null,
      sectorEtf: "XLK",
      sectorIntradayPct: null,
      vsSpyPct: 0.1,
      vsQqqPct: null,
      vsSectorPct: null,
      gapPct: null,
      rvol: opts?.rvol ?? 1.8,
      vwapLocation: "ABOVE",
      intradayTrend: "RANGE",
      rankScore: 55,
      notes: [],
    },
  } as unknown as LiveSetupCard;
}

describe("WatchMonitor / MonitorHub Phase 2", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("enforces max 6 symbols and rejects a 7th", async () => {
    const scan = vi.fn(async ({ symbol }: { symbol: string }) => fakeCard(symbol));
    const scanner = { scan } as unknown as SetupScanner;
    const hub = new MonitorHub(scanner, { maxSymbols: 6, intervalMs: 60_000 });

    await hub.setWatchlist("u1", [
      ...DEFAULT_MONITOR_WATCHLIST,
      { symbol: "AAPL", side: "LONG" },
    ]);
    expect(hub.snapshot("u1").symbols).toHaveLength(6);
    expect(hub.snapshot("u1").symbols.map((s) => s.symbol)).not.toContain("AAPL");

    expect(() => hub.get("u1").add("AAPL")).toThrow(MonitorLimitError);
    hub.stopAll();
  });

  it("deduplicates shared symbol:side scans across users", async () => {
    const scan = vi.fn(async ({ symbol }: { symbol: string }) => fakeCard(symbol));
    const scanner = { scan } as unknown as SetupScanner;
    const hub = new MonitorHub(scanner, { maxSymbols: 6, intervalMs: 60_000 });

    hub.restoreSession("user-a", [
      { symbol: "NVDA", side: "LONG" },
      { symbol: "TSLA", side: "LONG" },
    ]);
    hub.restoreSession("user-b", [
      { symbol: "NVDA", side: "LONG" },
      { symbol: "AMD", side: "LONG" },
    ]);

    await hub.tick();
    // NVDA scanned once, not twice
    const nvdaCalls = scan.mock.calls.filter((c) => c[0].symbol === "NVDA");
    expect(nvdaCalls).toHaveLength(1);
    expect(scan).toHaveBeenCalledTimes(3); // NVDA, TSLA, AMD
    expect(hub.metrics().uniquePairsLastCycle).toBe(3);
    hub.stopAll();
  });

  it("rejects duplicate symbols and invalid tickers", () => {
    const mon = new WatchMonitor("desk", { maxSymbols: 6 });
    mon.setWatchlist([
      { symbol: "nvda", side: "LONG" },
      { symbol: "NVDA", side: "SHORT" },
      { symbol: "!!!", side: "LONG" },
    ]);
    expect(mon.list()).toEqual([{ symbol: "NVDA", side: "LONG" }]);
  });

  it("isolates watchlists between users", async () => {
    const scan = vi.fn(async ({ symbol }: { symbol: string }) => fakeCard(symbol));
    const scanner = { scan } as unknown as SetupScanner;
    const hub = new MonitorHub(scanner, { maxSymbols: 6, intervalMs: 60_000 });
    await hub.setWatchlist("alice", [{ symbol: "TSLA", side: "LONG" }]);
    await hub.setWatchlist("bob", [{ symbol: "MU", side: "LONG" }]);
    expect(hub.snapshot("alice").symbols.map((s) => s.symbol)).toEqual(["TSLA"]);
    expect(hub.snapshot("bob").symbols.map((s) => s.symbol)).toEqual(["MU"]);
    hub.stopAll();
  });

  it("records alert events once per transition (dedupe)", async () => {
    const store = new MemoryAlertEventStore();
    let label = "WAIT";
    let near = false;
    let five: string = "WAITING";
    const scan = vi.fn(async ({ symbol }: { symbol: string }) =>
      fakeCard(symbol, {
        statusLabel: label,
        state: near ? "NEAR_ACTIVE" : "WAIT",
        nearActive: near,
        fiveMin: five,
        score: 80,
      }),
    );
    const scanner = { scan } as unknown as SetupScanner;
    const hub = new MonitorHub(scanner, {
      maxSymbols: 6,
      intervalMs: 60_000,
      alertStore: store,
    });
    await hub.setWatchlist("trader", [{ symbol: "NVDA", side: "LONG" }]);
    // First tick establishes WAIT
    expect((await store.list("trader")).length).toBe(0);

    near = true;
    label = "NEAR ACTIVE";
    await hub.tick();
    const afterNear = await store.list("trader");
    expect(afterNear.length).toBeGreaterThanOrEqual(1);
    expect(afterNear[0]?.newStatus).toMatch(/NEAR ACTIVE|CONFIRMATION/);

    // Same status again — no duplicate in same minute bucket for identical transition
    const count = afterNear.length;
    await hub.tick();
    expect((await store.list("trader")).length).toBe(count);
    hub.stopAll();
  });

  it("ranks fresher near-active setups above stale/missed", async () => {
    const scan = vi.fn(async ({ symbol }: { symbol: string }) => {
      if (symbol === "TSLA") {
        return fakeCard(symbol, {
          score: 90,
          nearActive: true,
          statusLabel: "NEAR ACTIVE",
          state: "NEAR_ACTIVE",
          dataFresh: true,
          rvol: 2,
        });
      }
      return fakeCard(symbol, {
        score: 95,
        statusLabel: "MISSED",
        state: "MISSED",
        dataFresh: false,
      });
    });
    const scanner = { scan } as unknown as SetupScanner;
    const hub = new MonitorHub(scanner, { maxSymbols: 6, intervalMs: 60_000 });
    await hub.setWatchlist("rank", [
      { symbol: "AMD", side: "LONG" },
      { symbol: "TSLA", side: "LONG" },
    ]);
    const ranked = hub.snapshot("rank").ranked;
    expect(ranked[0]?.symbol).toBe("TSLA");
    hub.stopAll();
  });

  it("maps confirmation display status without ENTRY ACTIVE", () => {
    expect(
      toUserFacingStatus({
        state: "NEAR_ACTIVE",
        statusLabel: "NEAR ACTIVE",
        fiveMinStatus: "WAITING",
        nearActive: true,
        dataFresh: true,
      }),
    ).toBe("CONFIRMATION");
    expect(
      toUserFacingStatus({
        state: "ENTRY_ACTIVE_LONG",
        statusLabel: "ENTRY ACTIVE",
        fiveMinStatus: "PASS",
        nearActive: true,
        dataFresh: true,
      }),
    ).toBe("ENTRY ACTIVE");
    expect(
      toUserFacingStatus({
        state: "WAIT",
        statusLabel: "WAIT",
        fiveMinStatus: "WAITING",
        nearActive: false,
        dataFresh: false,
      }),
    ).toBe("DATA NOT VERIFIED");
  });

  it("keeps automatic trading disabled in policy", () => {
    expect(EXECUTION_POLICY.automaticOrders).toBe(false);
    expect(isAlertWorthyTransition("WAIT", "NEAR ACTIVE")).toBe(true);
    expect(isAlertWorthyTransition("NEAR ACTIVE", "NEAR ACTIVE")).toBe(false);
  });

  it("supports replace and remove", async () => {
    const scan = vi.fn(async ({ symbol }: { symbol: string }) => fakeCard(symbol));
    const scanner = { scan } as unknown as SetupScanner;
    const hub = new MonitorHub(scanner, { maxSymbols: 6, intervalMs: 60_000 });
    await hub.setWatchlist("u", [{ symbol: "NVDA", side: "LONG" }]);
    await hub.replaceSymbol("u", "NVDA", "AMD", "LONG");
    expect(hub.snapshot("u").symbols.map((s) => s.symbol)).toEqual(["AMD"]);
    await hub.removeSymbol("u", "AMD");
    expect(hub.snapshot("u").symbols).toHaveLength(0);
    hub.stopAll();
  });

  it("default watchlist is the Phase 2 six", () => {
    expect(DEFAULT_MONITOR_WATCHLIST.map((s) => s.symbol)).toEqual([
      "TSLA",
      "MU",
      "NVDA",
      "AMD",
      "SPY",
      "QQQ",
    ]);
  });
});
