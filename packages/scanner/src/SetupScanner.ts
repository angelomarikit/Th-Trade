import { evaluateSetup, type LiveSetupCard, type OptionsCardInfo } from "@wulu/confirmation";
import type { SetupState, TradeSide } from "@wulu/domain";
import type { MarketDataProvider, MarketSnapshot } from "@wulu/market-data";
import {
  buildWhyMoving,
  emptyWhyMoving,
  selectPrimaryCatalystForTicker,
  type CatalystEvent,
  type MarketReactionContext,
  type NewsService,
  type WhyMovingBlock,
} from "@wulu/news";
import {
  buildMorningBrief,
  buildRelativeMomentum,
  formatMorningBriefText,
  RegimeService,
  resolveDiscoveryUniverse,
  scoreDiscoveryUniverse,
  type MorningBrief,
  type ScoredOpportunity,
} from "@wulu/regime";
import { matchStrategiesOnBars } from "@wulu/strategies";
import { HistoricalEdgeService } from "@wulu/backtest";
import type { JournalEntry, SignalJournal } from "@wulu/journal";
import type { OptionsEngine } from "@wulu/options";

export interface ScanSetupRequest {
  symbol: string;
  side: TradeSide;
  marketReaction?: MarketReactionContext;
  /** When false, skip journal write (default true if journal configured) */
  recordJournal?: boolean;
  /** Reuse a pre-fetched snapshot (discovery confirm batch). */
  preloadedSnapshot?: MarketSnapshot;
  /** Reuse catalyst from a batch news fetch (discovery confirm). */
  preloadedCatalyst?: { why: WhyMovingBlock; event: CatalystEvent | null };
  /** Skip options engine — confirm path only needs setup state/gates. */
  skipOptions?: boolean;
  /** Prior lifecycle state — enables MISSED / INVALIDATED transitions on monitor ticks. */
  previousState?: SetupState;
  /** Preview lab scan (API `lab=1` only). */
  labMode?: boolean;
  /** Lab + `mockRth=1`: RTH gate profile on SIP replay. */
  mockRth?: boolean;
  /** Lab paper drill: synthetic ENTRY ACTIVE (`mockEnter=1` + sim RTH). */
  mockEnter?: boolean;
}

export interface ScanSetupResult {
  card: LiveSetupCard;
  journalEntry: JournalEntry | null;
}

export interface SetupScannerOptions {
  journal?: SignalJournal | null;
  optionsEngine?: OptionsEngine | null;
  optionsEnabled?: boolean;
}

/**
 * Stage-2 deep analysis: market + news + regime + strategies + edge + journal + options (flagged).
 */
export class SetupScanner {
  private readonly regimeService: RegimeService;
  private readonly edgeService = new HistoricalEdgeService();
  private readonly journal: SignalJournal | null;
  private readonly optionsEngine: OptionsEngine | null;
  private readonly optionsEnabled: boolean;

  constructor(
    private readonly marketData: MarketDataProvider,
    private readonly news: NewsService,
    opts: SetupScannerOptions | SignalJournal | null = null,
  ) {
    this.regimeService = new RegimeService(marketData);
    // Back-compat: third arg may be journal directly
    if (opts && typeof opts === "object" && "record" in opts) {
      this.journal = opts as SignalJournal;
      this.optionsEngine = null;
      this.optionsEnabled = false;
    } else {
      const o = (opts ?? {}) as SetupScannerOptions;
      this.journal = o.journal ?? null;
      this.optionsEngine = o.optionsEngine ?? null;
      this.optionsEnabled = o.optionsEnabled === true;
    }
  }



  async scan(request: ScanSetupRequest): Promise<LiveSetupCard> {
    const result = await this.scanWithJournal(request);
    return result.card;
  }

  /** Batch Alpaca snapshots for monitor ticks (~3 HTTP calls vs ~4×N sequential). */
  async preloadSnapshots(symbols: string[]): Promise<Map<string, MarketSnapshot>> {
    const unique = [...new Set(symbols.map((s) => s.trim().toUpperCase()).filter(Boolean))];
    if (unique.length === 0 || !this.marketData.getSnapshots) {
      return new Map();
    }
    try {
      const batch = await this.marketData.getSnapshots(unique);
      return new Map(batch.map((s) => [s.symbol, s]));
    } catch {
      return new Map();
    }
  }

  async scanWithJournal(request: ScanSetupRequest): Promise<ScanSetupResult> {
    const symbol = request.symbol.toUpperCase();
    const snapshot =
      request.preloadedSnapshot ?? (await this.marketData.getSnapshot(symbol));

    const reaction: MarketReactionContext =
      request.marketReaction ??
      inferReactionFromSnapshot(snapshot.lastPrice, snapshot);

    const catalystPromise = request.preloadedCatalyst
      ? Promise.resolve(request.preloadedCatalyst)
      : this.news.getCatalystForTicker(symbol, reaction).catch((err: unknown) => {
          const message = err instanceof Error ? err.message : String(err);
          console.warn(`[news] ${symbol}: ${message.slice(0, 160)}`);
          return { event: null, why: emptyWhyMoving() };
        });

    const [{ why, event }, regimeCtx] = await Promise.all([
      catalystPromise,
      this.regimeService.getContextForSymbol(symbol, request.side, snapshot),
    ]);

    const bars = snapshot.bars5m.length >= 20 ? snapshot.bars5m : snapshot.bars1m;
    const matches = matchStrategiesOnBars({
      symbol,
      bars,
      side: request.side,
      regimePrimary: regimeCtx.regime.primary,
      hasCatalyst: why.hasVerifiedCatalyst,
      enabledFamilies: { ...regimeCtx.regime.strategyGates },
    });


    const edge = this.edgeService.bestEdgeForMatches({
      strategyIds: matches.map((m) => m.signal.strategyId),
      symbol,
      bars,
      regimePrimary: regimeCtx.regime.primary,
      hasCatalyst: why.hasVerifiedCatalyst,
    });

    // If no live match, still attach edge for a default family-friendly strategy when possible
    const fallbackEdge =
      edge ??
      this.tryFallbackEdge(symbol, bars, request.side, regimeCtx.regime.primary, why.hasVerifiedCatalyst);

    const feed = process.env.ALPACA_DATA_FEED ?? "iex";
    const relativeMomentum = buildRelativeMomentum({
      symbolSnapshot: snapshot,
      spy: regimeCtx.spy,
      qqq: regimeCtx.qqq,
      sectorEtf: regimeCtx.sectorEtf,
      sector: regimeCtx.sector,
      feed,
    });

    let card = evaluateSetup({
      symbol,
      side: request.side,
      snapshot,
      previousState: request.previousState,
      labMode: request.labMode,
      mockRth: request.mockRth,
      mockEnter: request.mockEnter,
      whyMoving: why,
      marketRegime: {
        status: regimeCtx.marketRegime.status,
        reason: regimeCtx.marketRegime.reason,
      },
      sectorAlignment: {
        status: regimeCtx.sectorAlignment.status,
        reason: regimeCtx.sectorAlignment.reason,
      },
      regimeInfo: {
        primary: regimeCtx.regime.primary,
        bias: regimeCtx.regime.bias,
        reasons: regimeCtx.regime.reasons,
        strategyGates: { ...regimeCtx.regime.strategyGates },
      },
      matchedStrategies: matches.map((m) => ({
        strategyId: m.signal.strategyId,
        strategyName: m.strategyName,
        family: m.family,
        reason: m.signal.reason,
      })),
      historicalEdge: fallbackEdge
        ? {
            strategyId: fallbackEdge.strategyId,
            strategyName: fallbackEdge.strategyName,
            sampleSize: fallbackEdge.sampleSize,
            winRatePct: fallbackEdge.winRatePct,
            averageWinnerR: fallbackEdge.averageWinnerR,
            averageLoserR: fallbackEdge.averageLoserR,
            expectancyR: fallbackEdge.expectancyR,
            profitFactor: fallbackEdge.profitFactor,
            maxDrawdownR: fallbackEdge.maxDrawdownR,
            bestRegime: fallbackEdge.bestRegime,
            disclaimer: fallbackEdge.disclaimer,
            collapsedSummary: fallbackEdge.collapsedSummary,
          }
        : null,
      catalystQualityScore: event
        ? event.scores.catalystImportance.score
        : 30,
      priceReactionScore: event
        ? event.scores.marketReactionConfirmation.score
        : 40,
      marketAlignmentScore: statusToScore(regimeCtx.marketRegime.status),
      sectorAlignmentScore: statusToScore(regimeCtx.sectorAlignment.status),
      options: null,
      relativeMomentum,
    });

    card = {
      ...card,
      options: request.skipOptions
        ? {
            enabled: false,
            eligible: false,
            reason: "Options skipped for confirm-path latency",
            direction: null,
            bestContract: null,
            whyThisContract: [],
            automaticOrders: false,
          }
        : await this.resolveOptions(card),
    };

    let journalEntry: JournalEntry | null = null;
    const shouldRecord = request.recordJournal !== false && this.journal != null;
    if (shouldRecord && this.journal) {
      journalEntry = this.journal.record(card);
      // Best-effort outcome refresh for prior open entries on this symbol
      this.journal.refreshOutcomes({ symbol, bars });
    }

    return { card, journalEntry };
  }

  private async resolveOptions(card: LiveSetupCard): Promise<OptionsCardInfo | null> {
    if (!this.optionsEnabled || !this.optionsEngine) {
      return {
        enabled: false,
        eligible: false,
        reason: "FEATURE_OPTIONS_ENGINE=false — options engine disabled",
        direction: null,
        bestContract: null,
        whyThisContract: [],
        automaticOrders: false,
      };
    }

    const result = await this.optionsEngine.evaluate({
      enabled: true,
      underlyingState: card.state,
      side: card.side,
      underlying: card.symbol,
    });

    return {
      enabled: result.enabled,
      eligible: result.eligible,
      reason: result.reason,
      direction: result.direction,
      bestContract: result.best
        ? {
            right: result.best.contract.right,
            strike: result.best.contract.strike,
            expiration: result.best.contract.expiration,
            dte: result.best.contract.dte,
            delta: result.best.contract.delta,
            bid: result.best.contract.bid,
            ask: result.best.contract.ask,
            spread: result.best.contract.spread,
            spreadPct: result.best.contract.spreadPct,
            volume: result.best.contract.volume,
            openInterest: result.best.contract.openInterest,
          }
        : null,
      whyThisContract: result.best?.whyThisContract ?? [],
      automaticOrders: false,
    };
  }



  /**
   * Phase 5: scan curated universe via cheap batch snapshots, rank LONG/SHORT.
   * Optionally run existing evaluateSetup confirmation on top N (unchanged gates).
   * Ranking never grants ENTRY ACTIVE.
   */
  async discoverOpportunities(opts?: {
    universe?: string[];
    topN?: number;
    confirmTop?: number;
  }): Promise<{
    feed: string;
    universeSize: number;
    scanned: number;
    elapsedMs: number;
    discoveryElapsedMs: number;
    confirmElapsedMs: number;
    long: ScoredOpportunity[];
    short: ScoredOpportunity[];
    confirmed: Array<{
      symbol: string;
      side: TradeSide;
      discoveryRank: number;
      discoveryScore: number;
      state: string;
      statusLabel: string;
      rewardToRisk: number;
      qualityScore10: number | null;
    }>;
    disclaimer: string;
    automaticOrders: false;
  }> {
    const started = Date.now();
    const universe = opts?.universe?.length
      ? [...new Set(opts.universe.map((s) => s.toUpperCase()))]
      : resolveDiscoveryUniverse();
    const topN = Math.min(Math.max(opts?.topN ?? 15, 1), 40);
    const confirmTop = Math.min(Math.max(opts?.confirmTop ?? 0, 0), 8);

    if (!this.marketData.getDiscoverySnapshots) {
      throw new Error("Market data provider does not support discovery snapshots");
    }

    const snaps = await this.marketData.getDiscoverySnapshots(universe);

    const catalystBySymbol: Record<string, { boost: number; headline: string | null }> = {};
    let discoveryEvents: CatalystEvent[] = [];
    try {
      discoveryEvents = await this.news.getCatalystEvents({
        tickers: snaps.slice(0, 40).map((s) => s.symbol),
      });
      for (const ev of discoveryEvents.slice(0, 80)) {
        for (const t of ev.tickers ?? []) {
          const sym = String(t).toUpperCase();
          const importance = Number(ev.scores?.catalystImportance?.score ?? 0);
          const boost = importance >= 70 ? 8 : importance >= 50 ? 5 : importance >= 30 ? 2 : 0;
          const prev = catalystBySymbol[sym];
          if (!prev || boost > prev.boost) {
            catalystBySymbol[sym] = {
              boost,
              headline: ev.headline ?? null,
            };
          }
        }
      }
    } catch {
      // News optional — discovery still works without catalysts
    }

    const scored = scoreDiscoveryUniverse({ snaps, catalystBySymbol });
    const long = scored.long.slice(0, topN).map((r, i) => ({ ...r, rank: i + 1 }));
    const short = scored.short.slice(0, topN).map((r, i) => ({ ...r, rank: i + 1 }));
    const discoveryElapsedMs = Date.now() - started;

    const confirmed: Array<{
      symbol: string;
      side: TradeSide;
      discoveryRank: number;
      discoveryScore: number;
      state: string;
      statusLabel: string;
      rewardToRisk: number;
      qualityScore10: number | null;
    }> = [];
    let confirmElapsedMs = 0;

    if (confirmTop > 0) {
      const confirmStarted = Date.now();
      const toConfirm = [
        ...long.slice(0, confirmTop).map((r) => ({ ...r, side: "LONG" as const })),
        ...short.slice(0, confirmTop).map((r) => ({ ...r, side: "SHORT" as const })),
      ];
      const confirmSymbols = [...new Set(toConfirm.map((r) => r.symbol))];

      const snapBySymbol = new Map<string, MarketSnapshot>();
      try {
        if (this.marketData.getSnapshots) {
          const batch = await this.marketData.getSnapshots(confirmSymbols);
          for (const s of batch) snapBySymbol.set(s.symbol, s);
        }
      } catch {
        // Fall back to per-symbol getSnapshot inside scan
      }

      try {
        await this.regimeService.warmForSymbols(confirmSymbols);
      } catch {
        // Per-scan regime fetch still works
      }

      for (const row of toConfirm) {
        try {
          const event = selectPrimaryCatalystForTicker(discoveryEvents, row.symbol);
          const why = buildWhyMoving(event);
          const card = await this.scan({
            symbol: row.symbol,
            side: row.side,
            recordJournal: false,
            skipOptions: true,
            preloadedSnapshot: snapBySymbol.get(row.symbol),
            preloadedCatalyst: { why, event },
          });
          confirmed.push({
            symbol: row.symbol,
            side: row.side,
            discoveryRank: (row as ScoredOpportunity & { rank?: number }).rank ?? 0,
            discoveryScore: row.rankScore,
            state: card.state,
            statusLabel: card.statusLabel,
            rewardToRisk: card.rewardToRisk,
            qualityScore10: card.qualityScore10?.score ?? null,
          });
        } catch {
          // Skip failed confirmation — never invent ENTRY ACTIVE
        }
      }
      confirmElapsedMs = Date.now() - confirmStarted;
    }

    return {
      feed: process.env.ALPACA_DATA_FEED ?? "iex",
      universeSize: universe.length,
      scanned: snaps.length,
      elapsedMs: Date.now() - started,
      discoveryElapsedMs,
      confirmElapsedMs,
      long: long as ScoredOpportunity[],
      short: short as ScoredOpportunity[],
      confirmed,
      disclaimer:
        "Discovery ranks are context only — not ENTRY permission. Confirmation uses unchanged Phase 3/4 gates (min 2R). IEX ≠ consolidated volume. Auto-trading disabled. Not a published win rate.",
      automaticOrders: false,
    };
  }

  /**
   * Rank watchlist symbols by computed relative momentum (actual bars).
   * Ranking is context only — never entry permission.
   */
  async rankWatchlist(tickers: string[]): Promise<
    Array<{
      symbol: string;
      rank: number;
      momentum: ReturnType<typeof buildRelativeMomentum>;
    }>
  > {
    const unique = [...new Set(tickers.map((t) => t.toUpperCase()).filter(Boolean))].slice(0, 25);
    const { qqq } = await this.regimeService.getRegime();
    const rows: Array<{ symbol: string; momentum: ReturnType<typeof buildRelativeMomentum> }> = [];
    for (const symbol of unique) {
      try {
        const snapshot = await this.marketData.getSnapshot(symbol);
        const ctx = await this.regimeService.getContextForSymbol(symbol, "LONG", snapshot);
        rows.push({
          symbol,
          momentum: buildRelativeMomentum({
            symbolSnapshot: snapshot,
            spy: ctx.spy,
            qqq: ctx.qqq ?? qqq,
            sectorEtf: ctx.sectorEtf,
            sector: ctx.sector,
            feed: process.env.ALPACA_DATA_FEED ?? "iex",
          }),
        });
      } catch {
        // Skip failed symbols — never invent rankings
      }
    }
    rows.sort((a, b) => b.momentum.rankScore - a.momentum.rankScore);
    return rows.map((r, i) => ({ symbol: r.symbol, rank: i + 1, momentum: r.momentum }));
  }

  async morningBrief(input?: {
    tickers?: Array<{ symbol: string; side: TradeSide }>;
    majorEventsToday?: string[];
  }): Promise<{ brief: MorningBrief; text: string }> {
    const { regime } = await this.regimeService.getRegime();
    const setups: LiveSetupCard[] = [];

    for (const t of input?.tickers ?? []) {
      try {
        setups.push(await this.scan({ symbol: t.symbol, side: t.side }));
      } catch {
        // Skip failed symbols — never invent candidates
      }
    }

    const brief = buildMorningBrief({
      regime,
      setups,
      majorEventsToday: input?.majorEventsToday,
    });
    return { brief, text: formatMorningBriefText(brief) };
  }

  get edge(): HistoricalEdgeService {
    return this.edgeService;
  }

  get signalJournal(): SignalJournal | null {
    return this.journal;
  }


  private tryFallbackEdge(
    symbol: string,
    bars: import("@wulu/market-data").Bar[],
    side: TradeSide,
    regimePrimary: string,
    hasCatalyst: boolean,
  ) {
    const fallbackId = side === "LONG" ? "VWAP_RECLAIM" : "VWAP_REJECTION";
    try {
      return this.edgeService.compute({
        strategyId: fallbackId,
        symbol,
        bars,
        regimePrimary,
        hasCatalyst,
        includeWalkForward: true,
      }).panel;
    } catch {
      return null;
    }
  }
}

function statusToScore(status: string): number {
  if (status === "PASS") return 90;
  if (status === "WAITING") return 50;
  if (status === "FAIL") return 15;
  return 40;
}

function inferReactionFromSnapshot(
  lastPrice: number,
  snapshot: { bars1m: { vwap?: number; high: number; low: number; close: number; volume: number }[] },
): MarketReactionContext {
  const bars = snapshot.bars1m;
  if (!bars.length) {
    return {
      priceVsVwap: "UNKNOWN",
      relativeVolume: "UNKNOWN",
      relativeStrength: "UNKNOWN",
    };
  }

  let pv = 0;
  let vol = 0;
  for (const b of bars) {
    const typical = b.vwap ?? (b.high + b.low + b.close) / 3;
    pv += typical * b.volume;
    vol += b.volume;
  }
  const vwap = vol > 0 ? pv / vol : lastPrice;
  const recentVol = bars.slice(-5).reduce((a, b) => a + b.volume, 0) / Math.min(5, bars.length);
  const baseVol = vol / bars.length;
  const rvol = baseVol > 0 ? recentVol / baseVol : 1;

  return {
    priceVsVwap:
      lastPrice > vwap * 1.001 ? "ABOVE" : lastPrice < vwap * 0.999 ? "BELOW" : "AT",
    relativeVolume: rvol >= 1.5 ? "HIGH" : rvol <= 0.7 ? "LOW" : "NORMAL",
    relativeStrength: "INLINE",
  };
}
