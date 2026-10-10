import type { TradeSide } from "@wulu/domain";
import type { SetupScanner } from "./SetupScanner.js";

export const MONITOR_MAX_SYMBOLS_DEFAULT = 6;

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
  alertAt: number | null;
  entryZone: { low: number; high: number; executable: boolean } | null;
  stop: number | null;
  t1: number | null;
  t2: number | null;
  conditionsPassed: number;
  conditionsTotal: number;
  setupScore: number | null;
  waitingFor: string[];
  dataFresh: boolean;
  session: string | null;
  distanceLabel: string | null;
  nearActive: boolean;
  signalAction: "BUY" | "SELL" | "WAIT" | null;
  rankScore: number | null;
  vsSpyPct: number | null;
  evaluatedAt: string | null;
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
  /** Ranked by setup readiness (score + near-active bias), not inventing opportunities */
  ranked: Array<{ symbol: string; side: TradeSide; status: string; setupScore: number | null; nearActive: boolean }>;
  lastTickAt: string | null;
  tickCount: number;
  note: string;
}

/**
 * Server-side multi-symbol monitor.
 * Runs independently of the browser; polls SetupScanner on an interval.
 */
export class WatchMonitor {
  private readonly configs = new Map<string, MonitorSymbolConfig>();
  private readonly states = new Map<string, MonitoredSymbolState>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private ticking = false;
  private lastTickAt: string | null = null;
  private tickCount = 0;
  private readonly maxSymbols: number;
  private readonly intervalMs: number;

  constructor(
    private readonly scanner: SetupScanner,
    private readonly sessionId: string,
    opts?: { maxSymbols?: number; intervalMs?: number },
  ) {
    this.maxSymbols = opts?.maxSymbols ?? MONITOR_MAX_SYMBOLS_DEFAULT;
    this.intervalMs = opts?.intervalMs ?? 20_000;
  }

  get running(): boolean {
    return this.timer != null;
  }

  list(): MonitorSymbolConfig[] {
    return [...this.configs.values()];
  }

  setWatchlist(items: MonitorSymbolConfig[]): MonitorSymbolConfig[] {
    const cleaned = normalizeConfigs(items).slice(0, this.maxSymbols);
    this.configs.clear();
    for (const c of cleaned) this.configs.set(c.symbol, c);
    // Drop stale states
    for (const sym of [...this.states.keys()]) {
      if (!this.configs.has(sym)) this.states.delete(sym);
    }
    if (cleaned.length > 0) this.ensureTimer();
    else this.stop();
    return this.list();
  }

  add(symbol: string, side: TradeSide = "LONG"): MonitorSymbolConfig[] {
    const sym = symbol.trim().toUpperCase();
    if (!sym) return this.list();
    if (!this.configs.has(sym) && this.configs.size >= this.maxSymbols) {
      throw new MonitorLimitError(
        `Monitor limit is ${this.maxSymbols} symbols (Step 2 capacity). Remove one before adding.`,
      );
    }
    this.configs.set(sym, { symbol: sym, side });
    this.ensureTimer();
    return this.list();
  }

  remove(symbol: string): MonitorSymbolConfig[] {
    const sym = symbol.trim().toUpperCase();
    this.configs.delete(sym);
    this.states.delete(sym);
    if (this.configs.size === 0) this.stop();
    return this.list();
  }

  /** Start interval loop and kick an immediate scan. */
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

  private ensureTimer(): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      void this.tick();
    }, this.intervalMs);
  }

  snapshot(): MonitorSnapshot {
    const states = [...this.states.values()];
    const ranked = [...states]
      .map((s) => ({
        symbol: s.symbol,
        side: s.side,
        status: s.status,
        setupScore: s.setupScore,
        nearActive: s.nearActive,
        sortKey: readinessScore(s),
      }))
      .sort((a, b) => b.sortKey - a.sortKey)
      .map(({ sortKey: _s, ...rest }) => rest);

    return {
      sessionId: this.sessionId,
      maxSymbols: this.maxSymbols,
      intervalMs: this.intervalMs,
      running: this.running,
      symbols: this.list(),
      states,
      ranked,
      lastTickAt: this.lastTickAt,
      tickCount: this.tickCount,
      note: "Server-side monitor — continues while the API process is running; browser need not stay open.",
    };
  }

  async tick(): Promise<void> {
    if (this.ticking) return;
    this.ticking = true;
    try {
      const list = this.list();
      for (const cfg of list) {
        await this.scanOne(cfg);
      }
      this.lastTickAt = new Date().toISOString();
      this.tickCount += 1;
    } finally {
      this.ticking = false;
    }
  }

  private async scanOne(cfg: MonitorSymbolConfig): Promise<void> {
    const updatedAt = new Date().toISOString();
    try {
      const card = await this.scanner.scan({
        symbol: cfg.symbol,
        side: cfg.side,
        recordJournal: false,
      });
      this.states.set(cfg.symbol, {
        symbol: card.symbol,
        side: card.side,
        status: card.statusLabel,
        state: card.state,
        lastPrice: card.lastPrice,
        alertAt: card.alertAt,
        entryZone: card.entryZone,
        stop: card.stop,
        t1: card.target1,
        t2: card.target2,
        conditionsPassed: card.conditionsPassed,
        conditionsTotal: card.conditionsTotal,
        setupScore: card.setupScore.total,
        waitingFor: card.nearActive.stillWaitingFor.slice(0, 6),
        dataFresh: card.dataFresh,
        session: card.session?.session ?? null,
        distanceLabel: card.nearActive.distanceLabel,
        nearActive: card.nearActive.active,
        signalAction: null,
        rankScore: card.relativeMomentum?.rankScore ?? null,
        vsSpyPct: card.relativeMomentum?.vsSpyPct ?? null,
        evaluatedAt: card.evaluatedAt,
        error: null,
        updatedAt,
      });
    } catch (err) {
      const prev = this.states.get(cfg.symbol);
      this.states.set(cfg.symbol, {
        symbol: cfg.symbol,
        side: cfg.side,
        status: prev?.status ?? "DATA NOT VERIFIED",
        state: prev?.state ?? "DATA_NOT_VERIFIED",
        lastPrice: prev?.lastPrice ?? null,
        alertAt: prev?.alertAt ?? null,
        entryZone: prev?.entryZone ?? null,
        stop: prev?.stop ?? null,
        t1: prev?.t1 ?? null,
        t2: prev?.t2 ?? null,
        conditionsPassed: prev?.conditionsPassed ?? 0,
        conditionsTotal: prev?.conditionsTotal ?? 0,
        setupScore: prev?.setupScore ?? null,
        waitingFor: prev?.waitingFor ?? [],
        dataFresh: false,
        session: prev?.session ?? null,
        distanceLabel: prev?.distanceLabel ?? null,
        nearActive: false,
        signalAction: null,
        rankScore: prev?.rankScore ?? null,
        vsSpyPct: prev?.vsSpyPct ?? null,
        evaluatedAt: prev?.evaluatedAt ?? null,
        error: err instanceof Error ? err.message : String(err),
        updatedAt,
      });
    }
  }
}

export class MonitorLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MonitorLimitError";
  }
}

/** Hub of per-user (or default desk) monitors. */
export class MonitorHub {
  private readonly monitors = new Map<string, WatchMonitor>();

  constructor(
    private readonly scanner: SetupScanner,
    private readonly defaults?: { maxSymbols?: number; intervalMs?: number },
  ) {}

  get(sessionId: string): WatchMonitor {
    const id = sessionId.trim() || "default";
    let m = this.monitors.get(id);
    if (!m) {
      m = new WatchMonitor(this.scanner, id, this.defaults);
      this.monitors.set(id, m);
    }
    return m;
  }

  stopAll(): void {
    for (const m of this.monitors.values()) m.stop();
  }
}

function normalizeConfigs(items: MonitorSymbolConfig[]): MonitorSymbolConfig[] {
  const out: MonitorSymbolConfig[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const symbol = (item.symbol ?? "").trim().toUpperCase();
    if (!symbol || seen.has(symbol)) continue;
    const side = item.side === "SHORT" ? "SHORT" : "LONG";
    seen.add(symbol);
    out.push({ symbol, side });
  }
  return out;
}

function readinessScore(s: MonitoredSymbolState): number {
  let score = s.setupScore ?? 0;
  if (s.nearActive) score += 25;
  if (s.status.includes("ENTRY ACTIVE")) score += 40;
  if (!s.dataFresh || s.status.includes("DATA NOT VERIFIED")) score -= 50;
  if (s.error) score -= 30;
  return score;
}
