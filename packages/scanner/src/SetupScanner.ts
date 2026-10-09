import { evaluateSetup, type LiveSetupCard, type OptionsCardInfo } from "@wulu/confirmation";
import type { TradeSide } from "@wulu/domain";
import type { MarketDataProvider } from "@wulu/market-data";
import type { MarketReactionContext, NewsService } from "@wulu/news";
import {
  buildMorningBrief,
  formatMorningBriefText,
  RegimeService,
  type MorningBrief,
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

  async scanWithJournal(request: ScanSetupRequest): Promise<ScanSetupResult> {
    const symbol = request.symbol.toUpperCase();
    const snapshot = await this.marketData.getSnapshot(symbol);


    const reaction: MarketReactionContext =
      request.marketReaction ??
      inferReactionFromSnapshot(snapshot.lastPrice, snapshot);

    const [{ why, event }, regimeCtx] = await Promise.all([
      this.news.getCatalystForTicker(symbol, reaction),
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

    let card = evaluateSetup({
      symbol,
      side: request.side,
      snapshot,
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
    });

    card = {
      ...card,
      options: await this.resolveOptions(card),
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
