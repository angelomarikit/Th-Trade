import type { IndicatorReading, LiveSetupCard, OutcomeResolution } from "@wulu/confirmation";
import {
  buildWatchingSummary,
  deriveTradingAction,
  outcomeDetailToStatusLabel,
} from "@wulu/confirmation";
import { backgroundAlpacaShouldWait, withAlpacaPriority } from "@wulu/market-data";
import { SETUP_STATES, type SetupState, type TradeSide } from "@wulu/domain";
import {
  buildAlertEvent,
  isAlertWorthyTransition,
  type AlertEventStore,
  type MonitorAlertEvent,
} from "./alertEvents.js";
import { toUserFacingStatus } from "./displayStatus.js";
import type { SetupScanner } from "./SetupScanner.js";

/** Deep confirmation monitor cap — discovery can rank more; only top names are promoted here. */
export const MONITOR_MAX_SYMBOLS_DEFAULT = 12;
export const DEFAULT_MONITOR_WATCHLIST: MonitorSymbolConfig[] = [
  { symbol: "TSLA", side: "LONG" },
  { symbol: "MU", side: "LONG" },
  { symbol: "NVDA", side: "LONG" },
  { symbol: "AMD", side: "LONG" },
  { symbol: "SPY", side: "LONG" },
  { symbol: "QQQ", side: "LONG" },
];

export interface MonitorSymbolConfig {
  symbol: string;
  side: TradeSide;
}

export interface MonitoredSymbolState {
  symbol: string;
  side: TradeSide;
  status: string;
  state: string;
  lastPrice: number | null;
  pctChange: number | null;
  alertAt: number | null;
  distanceToTriggerPct: number | null;
  distanceLabel: string | null;
  entryZone: { low: number; high: number; executable: boolean } | null;
  stop: number | null;
  t1: number | null;
  t2: number | null;
  rewardToRisk: number | null;
  conditionsPassed: number;
  conditionsTotal: number;
  setupScore: number | null;
  waitingFor: string[];
  dataFresh: boolean;
  session: string | null;
  nearActive: boolean;
  signalAction: "BUY" | "SELL" | "WAIT" | null;
  rankScore: number | null;
  vsSpyPct: number | null;
  vwapStatus: string | null;
  vwapLocation: string | null;
  rvol: number | null;
  fiveMinStatus: string | null;
  feed: string | null;
  feedLimitation: string | null;
  marketDataAt: string | null;
  evaluatedAt: string | null;
  qualityScore10: number | null;
  falseBreakoutRisk: string | null;
  actionHint: string | null;
  retestPhase: string | null;
  retestRequired: boolean;
  target3: number | null;
  invalidation: number | null;
  setupId: string | null;
  statusLabel: string;
  strategyName: string | null;
  indicatorChecklist: IndicatorReading[];
  /** WAIT | ENTER | SKIP | INVALIDATED — customer action, not a broker order. */
  tradingAction: "WAIT" | "ENTER" | "SKIP" | "INVALIDATED";
  watchingSummary: string | null;
  outcomeDetail: string | null;
  outcomeR: number | null;
  dataFreshReason: string | null;
  entryGeometrySummary: string | null;
  quoteSpreadPct: number | null;
  error: string | null;
  updatedAt: string;
}

export interface MonitorSnapshot {
  sessionId: string;
  maxSymbols: number;
  intervalMs: number;
  running: boolean;
  symbols: MonitorSymbolConfig[];
  states: MonitoredSymbolState[];
  ranked: Array<{
    symbol: string;
    side: TradeSide;
    status: string;
    setupScore: number | null;
    nearActive: boolean;
    readinessScore: number;
  }>;
  lastTickAt: string | null;
  tickCount: number;
  lastCycleMs: number | null;
  note: string;
  feed: string;
  automaticOrders: false;
}

export interface MonitorHubMetrics {
  tickCount: number;
  lastTickAt: string | null;
  lastCycleMs: number | null;
  uniquePairsLastCycle: number;
  failedScansLastCycle: number;
  running: boolean;
}

/**
 * Per-user watchlist + latest states.
 * Scanning is driven by MonitorHub (single shared loop — not N browser polls).
 */
export class WatchMonitor {
  private readonly configs = new Map<string, MonitorSymbolConfig>();
  private readonly states = new Map<string, MonitoredSymbolState>();
  private lastTickAt: string | null = null;
  private tickCount = 0;
  private lastCycleMs: number | null = null;
  readonly maxSymbols: number;

  constructor(
    private readonly sessionId: string,
    opts?: { maxSymbols?: number },
  ) {
    this.maxSymbols = opts?.maxSymbols ?? MONITOR_MAX_SYMBOLS_DEFAULT;
  }

  get userId(): string {
    return this.sessionId;
  }

  list(): MonitorSymbolConfig[] {
    return [...this.configs.values()];
  }

  previousSetupState(symbol: string): SetupState | undefined {
    const raw = this.states.get(symbol.toUpperCase())?.state;
    if (!raw) return undefined;
    return SETUP_STATES.includes(raw as SetupState) ? (raw as SetupState) : undefined;
  }

  setWatchlist(items: MonitorSymbolConfig[]): MonitorSymbolConfig[] {
    const cleaned = normalizeConfigs(items).slice(0, this.maxSymbols);
    this.configs.clear();
    for (const c of cleaned) this.configs.set(c.symbol, c);
    for (const sym of [...this.states.keys()]) {
      if (!this.configs.has(sym)) this.states.delete(sym);
    }
    for (const c of cleaned) {
      if (!this.states.has(c.symbol)) {
        this.states.set(c.symbol, createPendingScanState(c));
      }
    }
    return this.list();
  }

  add(symbol: string, side: TradeSide = "LONG"): MonitorSymbolConfig[] {
    const sym = normalizeTicker(symbol);
    if (!sym) return this.list();
    if (!this.configs.has(sym) && this.configs.size >= this.maxSymbols) {
      throw new MonitorLimitError(
        `Monitor limit is ${this.maxSymbols} symbols (Phase 2 capacity). Remove one before adding.`,
      );
    }
    this.configs.set(sym, { symbol: sym, side });
    if (!this.states.has(sym)) {
      this.states.set(sym, createPendingScanState({ symbol: sym, side }));
    }
    return this.list();
  }

  remove(symbol: string): MonitorSymbolConfig[] {
    const sym = normalizeTicker(symbol);
    this.configs.delete(sym);
    this.states.delete(sym);
    return this.list();
  }

  replace(from: string, to: string, side: TradeSide = "LONG"): MonitorSymbolConfig[] {
    const oldSym = normalizeTicker(from);
    const newSym = normalizeTicker(to);
    if (!oldSym || !newSym) return this.list();
    if (!this.configs.has(oldSym)) {
      throw new Error(`Symbol ${oldSym} is not on the watchlist`);
    }
    if (oldSym !== newSym && this.configs.has(newSym)) {
      throw new Error(`Symbol ${newSym} is already on the watchlist`);
    }
    const cfg = this.configs.get(oldSym)!;
    this.configs.delete(oldSym);
    this.states.delete(oldSym);
    const nextSide = side ?? cfg.side;
    this.configs.set(newSym, { symbol: newSym, side: nextSide });
    this.states.set(newSym, createPendingScanState({ symbol: newSym, side: nextSide }));
    return this.list();
  }

  applyCard(cfg: MonitorSymbolConfig, card: LiveSetupCard, feed: string): MonitorAlertEvent | null {
    const updatedAt = new Date().toISOString();
    const fiveMinStatus = matrixStatus(card, "FIVE_MIN_CONFIRMATION");
    const vwapStatus = matrixStatus(card, "VWAP");
    const status = toUserFacingStatus({
      state: card.state,
      statusLabel: card.statusLabel,
      fiveMinStatus,
      nearActive: card.nearActive.active,
      dataFresh: card.dataFresh,
    });
    const prev = this.states.get(cfg.symbol);
    const next: MonitoredSymbolState = {
      symbol: card.symbol,
      side: card.side,
      status,
      state: card.state,
      lastPrice: card.lastPrice,
      pctChange: card.relativeMomentum?.symbolIntradayPct ?? null,
      alertAt: card.alertAt,
      distanceToTriggerPct: card.nearActive.distanceToTriggerPct,
      distanceLabel: card.nearActive.distanceLabel,
      entryZone: card.entryZone,
      stop: card.stop,
      t1: card.target1,
      t2: card.target2,
      rewardToRisk: card.rewardToRisk,
      conditionsPassed: card.conditionsPassed,
      conditionsTotal: card.conditionsTotal,
      setupScore: card.setupScore.total,
      waitingFor: card.nearActive.stillWaitingFor.slice(0, 6),
      dataFresh: card.dataFresh,
      session: card.session?.session ?? null,
      nearActive: card.nearActive.active,
      signalAction: null,
      rankScore: card.relativeMomentum?.rankScore ?? null,
      vsSpyPct: card.relativeMomentum?.vsSpyPct ?? null,
      vwapStatus,
      vwapLocation: card.relativeMomentum?.vwapLocation ?? null,
      rvol: card.relativeMomentum?.rvol ?? null,
      fiveMinStatus,
      feed: card.relativeMomentum?.feed ?? feed,
      feedLimitation: card.relativeMomentum?.feedLimitation ?? null,
      marketDataAt: card.nearActive.dataTimestamp ?? card.evaluatedAt,
      evaluatedAt: card.evaluatedAt,
      qualityScore10: card.qualityScore10?.score ?? null,
      falseBreakoutRisk: card.signalIntelligence?.falseBreakoutRisk ?? null,
      actionHint: card.signalIntelligence?.actionHint ?? null,
      retestPhase: card.signalIntelligence?.retest.phase ?? null,
      retestRequired: card.signalIntelligence?.retest.retestRequired ?? false,
      target3: card.target3 ?? null,
      invalidation: card.invalidation ?? null,
      setupId: card.setupId,
      statusLabel: card.statusLabel,
      strategyName:
        card.matchedStrategies[0]?.strategyName ??
        card.historicalEdge?.strategyName ??
        null,
      indicatorChecklist: card.indicatorChecklist ?? [],
      ...(() => {
        const strategyName =
          card.matchedStrategies[0]?.strategyName ??
          card.historicalEdge?.strategyName ??
          null;
        const tradingAction = deriveTradingAction({
          state: card.state,
          statusLabel: card.statusLabel,
          userStatus: status,
          dataFresh: card.dataFresh,
          entryExecutable: card.entryZone.executable,
        });
        return {
          tradingAction,
          watchingSummary: buildWatchingSummary({
            symbol: card.symbol,
            side: card.side,
            strategyName,
            alertAt: card.alertAt,
            waitingFor: card.nearActive.stillWaitingFor.slice(0, 6),
            tradingAction,
          }),
        };
      })(),
      outcomeDetail: null,
      outcomeR: null,
      dataFreshReason: card.dataFreshReason ?? null,
      entryGeometrySummary: card.entryGeometry?.summary ?? null,
      quoteSpreadPct: card.quoteTransparency?.spreadPct ?? null,
      error: null,
      updatedAt,
    };
    this.states.set(cfg.symbol, next);

    if (prev && isAlertWorthyTransition(prev.status, next.status)) {
      return buildAlertEvent({
        userId: this.sessionId,
        symbol: next.symbol,
        side: next.side,
        previousStatus: prev.status,
        newStatus: next.status,
        marketDataAt: next.marketDataAt,
        trigger: next.alertAt,
        entryZone: next.entryZone,
        stop: next.stop,
        target1: next.t1,
        target2: next.t2,
        dataFresh: next.dataFresh,
        reason: buildMonitorTransitionReason(prev, next, card),
        confirmationDetails: next.waitingFor,
      });
    }
    return null;
  }

  applyOutcomeResolution(
    cfg: MonitorSymbolConfig,
    card: LiveSetupCard,
    resolution: OutcomeResolution,
  ): MonitorAlertEvent | null {
    const prev = this.states.get(cfg.symbol);
    if (!prev) return null;
    const status = outcomeDetailToStatusLabel(resolution.detail);
    const tradingAction = deriveTradingAction({
      state: card.state,
      statusLabel: status,
      userStatus: status,
      dataFresh: card.dataFresh,
      entryExecutable: false,
      outcomeDetail: resolution.detail,
    });
    const next: MonitoredSymbolState = {
      ...prev,
      status,
      statusLabel: status,
      state: "RESOLVED",
      tradingAction,
      watchingSummary: buildWatchingSummary({
        symbol: card.symbol,
        side: card.side,
        strategyName: prev.strategyName,
        alertAt: prev.alertAt,
        waitingFor: [resolution.note],
        tradingAction,
      }),
      outcomeDetail: resolution.detail,
      outcomeR: resolution.outcomeR,
      updatedAt: new Date().toISOString(),
    };
    this.states.set(cfg.symbol, next);
    if (prev && isAlertWorthyTransition(prev.status, next.status)) {
      return buildAlertEvent({
        userId: this.sessionId,
        symbol: next.symbol,
        side: next.side,
        previousStatus: prev.status,
        newStatus: next.status,
        marketDataAt: next.marketDataAt,
        trigger: next.alertAt,
        entryZone: next.entryZone,
        stop: next.stop,
        target1: next.t1,
        target2: next.t2,
        dataFresh: next.dataFresh,
        reason: resolution.note,
        confirmationDetails: [`outcomeR:${resolution.outcomeR ?? "—"}`, resolution.detail],
      });
    }
    return null;
  }

  applyError(cfg: MonitorSymbolConfig, err: unknown): MonitorAlertEvent | null {
    const updatedAt = new Date().toISOString();
    const prev = this.states.get(cfg.symbol);
    const message = err instanceof Error ? err.message : String(err);
    const readable = /cannot read properties of undefined/i.test(message)
      ? "Price check failed for this symbol. No trade from this row."
      : message;
    const next: MonitoredSymbolState = {
      symbol: cfg.symbol,
      side: cfg.side,
      status: "DATA NOT VERIFIED",
      state: "DATA_NOT_VERIFIED",
      lastPrice: prev?.lastPrice ?? null,
      pctChange: prev?.pctChange ?? null,
      alertAt: prev?.alertAt ?? null,
      distanceToTriggerPct: prev?.distanceToTriggerPct ?? null,
      distanceLabel: prev?.distanceLabel ?? null,
      entryZone: prev?.entryZone ?? null,
      stop: prev?.stop ?? null,
      t1: prev?.t1 ?? null,
      t2: prev?.t2 ?? null,
      rewardToRisk: prev?.rewardToRisk ?? null,
      conditionsPassed: prev?.conditionsPassed ?? 0,
      conditionsTotal: prev?.conditionsTotal ?? 0,
      setupScore: prev?.setupScore ?? null,
      waitingFor: prev?.waitingFor ?? [],
      dataFresh: false,
      session: prev?.session ?? null,
      nearActive: false,
      signalAction: null,
      rankScore: prev?.rankScore ?? null,
      vsSpyPct: prev?.vsSpyPct ?? null,
      vwapStatus: prev?.vwapStatus ?? null,
      vwapLocation: prev?.vwapLocation ?? null,
      rvol: prev?.rvol ?? null,
      fiveMinStatus: prev?.fiveMinStatus ?? null,
      feed: prev?.feed ?? null,
      feedLimitation: prev?.feedLimitation ?? null,
      marketDataAt: prev?.marketDataAt ?? null,
      evaluatedAt: prev?.evaluatedAt ?? null,
      qualityScore10: prev?.qualityScore10 ?? null,
      falseBreakoutRisk: prev?.falseBreakoutRisk ?? null,
      actionHint: "DATA NOT VERIFIED — NO TRADE",
      retestPhase: prev?.retestPhase ?? null,
      retestRequired: prev?.retestRequired ?? false,
      target3: prev?.target3 ?? null,
      invalidation: prev?.invalidation ?? null,
      setupId: prev?.setupId ?? null,
      statusLabel: "DATA NOT VERIFIED",
      strategyName: prev?.strategyName ?? null,
      indicatorChecklist: prev?.indicatorChecklist ?? [],
      tradingAction: "WAIT",
      watchingSummary: prev?.watchingSummary ?? null,
      outcomeDetail: prev?.outcomeDetail ?? null,
      outcomeR: prev?.outcomeR ?? null,
      dataFreshReason: prev?.dataFreshReason ?? null,
      entryGeometrySummary: prev?.entryGeometrySummary ?? null,
      quoteSpreadPct: prev?.quoteSpreadPct ?? null,
      error: readable,
      updatedAt,
    };
    this.states.set(cfg.symbol, next);
    if (prev && isAlertWorthyTransition(prev.status, next.status)) {
      return buildAlertEvent({
        userId: this.sessionId,
        symbol: next.symbol,
        side: next.side,
        previousStatus: prev.status,
        newStatus: next.status,
        marketDataAt: next.marketDataAt,
        trigger: next.alertAt,
        entryZone: next.entryZone,
        stop: next.stop,
        target1: next.t1,
        target2: next.t2,
        dataFresh: false,
        reason: `Provider/scan error — fail closed: ${message.slice(0, 200)}`,
        confirmationDetails: [],
      });
    }
    return null;
  }

  markCycle(cycleMs: number): void {
    this.lastTickAt = new Date().toISOString();
    this.tickCount += 1;
    this.lastCycleMs = cycleMs;
  }

  snapshot(intervalMs: number, hubRunning: boolean, feed: string): MonitorSnapshot {
    const states = this.list().map(
      (cfg) => this.states.get(cfg.symbol) ?? createPendingScanState(cfg),
    );
    const ranked = [...states]
      .map((s) => ({
        symbol: s.symbol,
        side: s.side,
        status: s.status,
        setupScore: s.setupScore,
        nearActive: s.nearActive,
        readinessScore: readinessScore(s),
      }))
      .sort((a, b) => b.readinessScore - a.readinessScore);

    return {
      sessionId: this.sessionId,
      maxSymbols: this.maxSymbols,
      intervalMs,
      running: hubRunning && this.configs.size > 0,
      symbols: this.list(),
      states,
      ranked,
      lastTickAt: this.lastTickAt,
      tickCount: this.tickCount,
      lastCycleMs: this.lastCycleMs,
      note:
        "Server-side shared monitor — continues while the API process is running; browser need not stay open. IEX feed ≠ consolidated volume.",
      feed,
      automaticOrders: false,
    };
  }
}

export class MonitorLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MonitorLimitError";
  }
}

export interface MonitorHubOptions {
  maxSymbols?: number;
  intervalMs?: number;
  feed?: string;
  alertStore?: AlertEventStore;
  /** Persist watchlist after mutations (Supabase / noop). */
  persistWatchlist?: (userId: string, symbols: MonitorSymbolConfig[]) => Promise<void>;
  /** Optional Phase 3/4 performance logger — called per user monitor after each card apply. */
  onSignalCard?: (
    card: import("@wulu/confirmation").LiveSetupCard,
    userId: string,
  ) =>
    | { opened?: unknown; resolution?: OutcomeResolution }
    | void;
}

/**
 * Central multi-user orchestrator.
 * One interval; deduplicates (symbol, side) scans across users each cycle.
 */
export class MonitorHub {
  private readonly monitors = new Map<string, WatchMonitor>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private ticking = false;
  private tickCount = 0;
  private lastTickAt: string | null = null;
  private lastCycleMs: number | null = null;
  private uniquePairsLastCycle = 0;
  private failedScansLastCycle = 0;
  private readonly maxSymbols: number;
  private readonly intervalMs: number;
  private readonly feed: string;
  private readonly alertStore: AlertEventStore | null;
  private readonly persistWatchlist:
    | ((userId: string, symbols: MonitorSymbolConfig[]) => Promise<void>)
    | null;
  private readonly onSignalCard: MonitorHubOptions["onSignalCard"] | null;

  constructor(
    private readonly scanner: SetupScanner,
    opts?: MonitorHubOptions,
  ) {
    this.maxSymbols = opts?.maxSymbols ?? MONITOR_MAX_SYMBOLS_DEFAULT;
    this.intervalMs = opts?.intervalMs ?? 20_000;
    this.feed = opts?.feed ?? "iex";
    this.alertStore = opts?.alertStore ?? null;
    this.persistWatchlist = opts?.persistWatchlist ?? null;
    this.onSignalCard = opts?.onSignalCard ?? null;
  }

  get(sessionId: string): WatchMonitor {
    const id = sessionId.trim() || "default";
    let m = this.monitors.get(id);
    if (!m) {
      m = new WatchMonitor(id, { maxSymbols: this.maxSymbols });
      this.monitors.set(id, m);
    }
    return m;
  }

  listSessionIds(): string[] {
    return [...this.monitors.keys()];
  }

  metrics(): MonitorHubMetrics {
    return {
      tickCount: this.tickCount,
      lastTickAt: this.lastTickAt,
      lastCycleMs: this.lastCycleMs,
      uniquePairsLastCycle: this.uniquePairsLastCycle,
      failedScansLastCycle: this.failedScansLastCycle,
      running: this.timer != null,
    };
  }

  async setWatchlist(sessionId: string, items: MonitorSymbolConfig[]): Promise<MonitorSnapshot> {
    const mon = this.get(sessionId);
    mon.setWatchlist(items);
    await this.persist(sessionId, mon.list());
    this.ensureTimer();
    await this.tick({ force: true });
    return mon.snapshot(this.intervalMs, this.timer != null, this.feed);
  }

  async addSymbol(
    sessionId: string,
    symbol: string,
    side: TradeSide = "LONG",
  ): Promise<MonitorSnapshot> {
    const mon = this.get(sessionId);
    mon.add(symbol, side);
    await this.persist(sessionId, mon.list());
    this.ensureTimer();
    await this.tick({ force: true });
    return mon.snapshot(this.intervalMs, this.timer != null, this.feed);
  }

  async removeSymbol(sessionId: string, symbol: string): Promise<MonitorSnapshot> {
    const mon = this.get(sessionId);
    mon.remove(symbol);
    await this.persist(sessionId, mon.list());
    if (this.totalSymbols() === 0) this.stop();
    else await this.tick({ force: true });
    return mon.snapshot(this.intervalMs, this.timer != null, this.feed);
  }

  async replaceSymbol(
    sessionId: string,
    from: string,
    to: string,
    side: TradeSide = "LONG",
  ): Promise<MonitorSnapshot> {
    const mon = this.get(sessionId);
    mon.replace(from, to, side);
    await this.persist(sessionId, mon.list());
    this.ensureTimer();
    await this.tick({ force: true });
    return mon.snapshot(this.intervalMs, this.timer != null, this.feed);
  }

  snapshot(sessionId: string): MonitorSnapshot {
    return this.get(sessionId).snapshot(this.intervalMs, this.timer != null, this.feed);
  }

  async listAlerts(sessionId: string, limit = 50): Promise<MonitorAlertEvent[]> {
    if (!this.alertStore) return [];
    return this.alertStore.list(sessionId, limit);
  }

  /** Restore watchlists after deploy/restart (no immediate scan storm — caller may tick). */
  restoreSession(sessionId: string, items: MonitorSymbolConfig[]): void {
    const mon = this.get(sessionId);
    mon.setWatchlist(items);
    if (mon.list().length > 0) this.ensureTimer();
  }

  start(): void {
    this.ensureTimer();
    void this.tick();
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  stopAll(): void {
    this.stop();
  }

  async tick(opts?: { force?: boolean }): Promise<void> {
    if (this.ticking) {
      if (opts?.force) await this.waitForTickComplete();
      else return;
    }
    if (!opts?.force && backgroundAlpacaShouldWait()) return;
    this.ticking = true;
    const started = Date.now();
    let failed = 0;
    try {
      const pairMap = new Map<string, { cfg: MonitorSymbolConfig; monitors: WatchMonitor[] }>();
      for (const mon of this.monitors.values()) {
        for (const cfg of mon.list()) {
          const key = `${cfg.symbol}:${cfg.side}`;
          const entry = pairMap.get(key);
          if (entry) entry.monitors.push(mon);
          else pairMap.set(key, { cfg, monitors: [mon] });
        }
      }
      this.uniquePairsLastCycle = pairMap.size;

      await withAlpacaPriority("background", async () => {
        const symbols = [...pairMap.values()].map(({ cfg }) => cfg.symbol);
        const snapBySymbol = this.scanner.preloadSnapshots
          ? await this.scanner.preloadSnapshots(symbols)
          : new Map();

        for (const { cfg, monitors } of pairMap.values()) {
          try {
            const previousState = monitors[0]?.previousSetupState(cfg.symbol);
            const card = await this.scanner.scan({
              symbol: cfg.symbol,
              side: cfg.side,
              recordJournal: false,
              preloadedSnapshot: snapBySymbol.get(cfg.symbol.toUpperCase()),
              previousState,
            });
            for (const mon of monitors) {
              const evt = mon.applyCard(cfg, card, this.feed);
              if (evt && this.alertStore) await this.alertStore.record(evt);
              // Foundation: log every evaluated card per user (store dedupes by id).
              if (this.onSignalCard) {
                const track = this.onSignalCard(card, mon.userId);
                if (track?.resolution) {
                  const outEvt = mon.applyOutcomeResolution(cfg, card, track.resolution);
                  if (outEvt && this.alertStore) await this.alertStore.record(outEvt);
                }
              }
            }
          } catch (err) {
            failed += 1;
            const message = err instanceof Error ? err.message : String(err);
            const stack = err instanceof Error && err.stack ? err.stack.split("\n").slice(0, 6).join(" | ") : "";
            console.warn(`[monitor] scan failed ${cfg.symbol}: ${message.slice(0, 180)} ${stack}`);
            for (const mon of monitors) {
              const evt = mon.applyError(cfg, err);
              if (evt && this.alertStore) await this.alertStore.record(evt);
            }
          }
        }
      });

      const cycleMs = Date.now() - started;
      this.lastCycleMs = cycleMs;
      this.lastTickAt = new Date().toISOString();
      this.tickCount += 1;
      this.failedScansLastCycle = failed;
      for (const mon of this.monitors.values()) {
        if (mon.list().length > 0) mon.markCycle(cycleMs);
      }
    } finally {
      this.ticking = false;
    }
  }

  private totalSymbols(): number {
    let n = 0;
    for (const m of this.monitors.values()) n += m.list().length;
    return n;
  }

  private ensureTimer(): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      void this.tick();
    }, this.intervalMs);
  }

  private async persist(sessionId: string, symbols: MonitorSymbolConfig[]): Promise<void> {
    if (!this.persistWatchlist || sessionId === "default") return;
    try {
      await this.persistWatchlist(sessionId, symbols);
    } catch (err) {
      console.warn(
        "[monitor] persist watchlist failed:",
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  private async waitForTickComplete(maxMs = 120_000): Promise<void> {
    const start = Date.now();
    while (this.ticking && Date.now() - start < maxMs) {
      await new Promise((r) => setTimeout(r, 40));
    }
  }
}

/** Placeholder row shown immediately after add — before the first monitor scan completes. */
export function createPendingScanState(cfg: MonitorSymbolConfig): MonitoredSymbolState {
  const updatedAt = new Date().toISOString();
  return {
    symbol: cfg.symbol,
    side: cfg.side,
    status: "SCANNING",
    state: "PENDING",
    lastPrice: null,
    pctChange: null,
    alertAt: null,
    distanceToTriggerPct: null,
    distanceLabel: null,
    entryZone: null,
    stop: null,
    t1: null,
    t2: null,
    rewardToRisk: null,
    conditionsPassed: 0,
    conditionsTotal: 0,
    setupScore: null,
    waitingFor: ["Running full setup scan (price, candles, indicators, confirmation rules)…"],
    dataFresh: false,
    session: null,
    nearActive: false,
    signalAction: null,
    rankScore: null,
    vsSpyPct: null,
    vwapStatus: null,
    vwapLocation: null,
    rvol: null,
    fiveMinStatus: null,
    feed: null,
    feedLimitation: null,
    marketDataAt: null,
    evaluatedAt: null,
    qualityScore10: null,
    falseBreakoutRisk: null,
    actionHint: null,
    retestPhase: null,
    retestRequired: false,
    target3: null,
    invalidation: null,
    setupId: null,
    statusLabel: "SCANNING",
    strategyName: null,
    indicatorChecklist: [],
    tradingAction: "WAIT",
    watchingSummary: `Scanning ${cfg.symbol} ${cfg.side} — loading live price, indicators, and recommendation…`,
    outcomeDetail: null,
    outcomeR: null,
    dataFreshReason: "Scan in progress — wait for this card to finish before trading.",
    entryGeometrySummary: null,
    quoteSpreadPct: null,
    error: null,
    updatedAt,
  };
}

function buildMonitorTransitionReason(
  prev: MonitoredSymbolState,
  next: MonitoredSymbolState,
  card: LiveSetupCard,
): string {
  const family = normalizeStatusFamily(next.status);
  if (family === "INVALIDATED") {
    if (card.invalidation != null && Number.isFinite(card.invalidation)) {
      return `Setup invalidated — structure broke (invalidation ${card.invalidation.toFixed(2)}).`;
    }
    return next.waitingFor[0] ?? "Structure, stop, or confirmation failed — do not enter.";
  }
  if (family === "MISSED") {
    return next.waitingFor[0] ?? "Price moved past the entry zone — do not chase.";
  }
  if (family === "ENTRY ACTIVE") {
    return "Entry conditions met on completed bars — verify live before acting.";
  }
  if (family.includes("TARGET HIT") || family.includes("STOP HIT")) {
    return next.watchingSummary ?? next.status;
  }
  const wait = next.waitingFor[0];
  if (wait) return wait;
  if (prev.status !== next.status) {
    return `Setup moved from ${prev.status} to ${next.status}.`;
  }
  return next.watchingSummary ?? next.status;
}

function normalizeStatusFamily(status: string): string {
  const u = status.toUpperCase();
  if (u.includes("INVALIDATED")) return "INVALIDATED";
  if (u.includes("MISSED")) return "MISSED";
  if (u.includes("ENTRY ACTIVE")) return "ENTRY ACTIVE";
  if (u.includes("TARGET HIT")) return "TARGET HIT";
  if (u.includes("STOP HIT")) return "STOP HIT";
  if (u.includes("NO TRADE")) return "NO TRADE";
  return u || "WAIT";
}

export function normalizeTicker(symbol: string): string {
  const sym = symbol.trim().toUpperCase();
  if (!/^[A-Z][A-Z0-9.]{0,9}$/.test(sym)) return "";
  return sym;
}

function normalizeConfigs(items: MonitorSymbolConfig[]): MonitorSymbolConfig[] {
  const out: MonitorSymbolConfig[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const symbol = normalizeTicker(item.symbol ?? "");
    if (!symbol || seen.has(symbol)) continue;
    const side = item.side === "SHORT" ? "SHORT" : "LONG";
    seen.add(symbol);
    out.push({ symbol, side });
  }
  return out;
}

function matrixStatus(card: LiveSetupCard, id: string): string | null {
  const row = card.matrix?.rows?.find((r) => r.id === id);
  return row?.status ?? null;
}

function readinessScore(s: MonitoredSymbolState): number {
  let score = s.setupScore ?? 0;
  if (s.status === "ENTRY ACTIVE") score += 40;
  else if (s.status === "CONFIRMATION") score += 30;
  else if (s.status === "NEAR ACTIVE" || s.nearActive) score += 25;
  if (s.rvol != null && s.rvol >= 1.5) score += 8;
  if (s.vwapLocation === "ABOVE" && s.side === "LONG") score += 5;
  if (s.vwapLocation === "BELOW" && s.side === "SHORT") score += 5;
  if (s.distanceToTriggerPct != null && Math.abs(s.distanceToTriggerPct) <= 0.25) score += 10;
  if (s.status === "MISSED" || s.status === "INVALIDATED" || s.status === "NO TRADE") score -= 40;
  if (!s.dataFresh || s.status === "DATA NOT VERIFIED") score -= 50;
  if (s.error) score -= 30;
  return score;
}
