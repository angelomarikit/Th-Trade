import type { MarketDataProvider, MarketSnapshot } from "@wulu/market-data";
import type { TradeSide } from "@wulu/domain";
import { evaluateMarketRegime } from "./RegimeEngine.js";
import {
  evaluateRegimeAlignment,
  evaluateSectorAlignment,
  type AlignmentResult,
} from "./alignment.js";
import type { RegimeSnapshot } from "./labels.js";
import { sectorEtfFor } from "./sectorMap.js";

export interface SymbolRegimeContext {
  regime: RegimeSnapshot;
  marketRegime: AlignmentResult;
  sectorAlignment: AlignmentResult;
  sectorEtf: string;
  spy: MarketSnapshot;
  qqq: MarketSnapshot | null;
  iwm: MarketSnapshot | null;
  sector: MarketSnapshot | null;
}

const REGIME_TTL_MS = Math.max(
  5_000,
  Number(process.env.REGIME_CACHE_TTL_MS ?? 30_000) || 30_000,
);
const SECTOR_TTL_MS = Math.max(
  5_000,
  Number(process.env.SECTOR_CACHE_TTL_MS ?? 45_000) || 45_000,
);

/**
 * Fetches index snapshots and builds regime + alignment for a symbol/side.
 * Short TTL caches avoid re-fetching SPY/QQQ/IWM on every confirm/scan.
 */
export class RegimeService {
  private regimeCache: {
    at: number;
    value: {
      regime: RegimeSnapshot;
      spy: MarketSnapshot;
      qqq: MarketSnapshot | null;
      iwm: MarketSnapshot | null;
    };
  } | null = null;
  private readonly sectorCache = new Map<string, { at: number; value: MarketSnapshot | null }>();

  constructor(private readonly marketData: MarketDataProvider) {}

  async getRegime(): Promise<{
    regime: RegimeSnapshot;
    spy: MarketSnapshot;
    qqq: MarketSnapshot | null;
    iwm: MarketSnapshot | null;
  }> {
    const now = Date.now();
    if (this.regimeCache && now - this.regimeCache.at < REGIME_TTL_MS) {
      return this.regimeCache.value;
    }

    let spy: MarketSnapshot;
    let qqq: MarketSnapshot | null;
    let iwm: MarketSnapshot | null;

    if (this.marketData.getSnapshots) {
      const batch = await this.marketData.getSnapshots(["SPY", "QQQ", "IWM"]);
      const by = new Map(batch.map((s) => [s.symbol, s]));
      const spySnap = by.get("SPY");
      if (!spySnap) {
        spy = await this.marketData.getSnapshot("SPY");
      } else {
        spy = spySnap;
      }
      qqq = by.get("QQQ") ?? null;
      iwm = by.get("IWM") ?? null;
    } else {
      [spy, qqq, iwm] = await Promise.all([
        this.marketData.getSnapshot("SPY"),
        this.safeSnapshot("QQQ"),
        this.safeSnapshot("IWM"),
      ]);
    }

    const regime = evaluateMarketRegime({ spy, qqq, iwm });
    const value = { regime, spy, qqq, iwm };
    this.regimeCache = { at: now, value };
    return value;
  }

  async getContextForSymbol(
    symbol: string,
    side: TradeSide,
    symbolSnapshot: MarketSnapshot,
  ): Promise<SymbolRegimeContext> {
    const { regime, spy, qqq, iwm } = await this.getRegime();
    const sectorEtf = sectorEtfFor(symbol);
    const sector =
      sectorEtf === "SPY" ? spy : await this.cachedSectorSnapshot(sectorEtf);

    return {
      regime,
      marketRegime: evaluateRegimeAlignment(regime, side),
      sectorAlignment: evaluateSectorAlignment({
        side,
        symbolSnapshot,
        sectorSnapshot: sector,
        spySnapshot: spy,
      }),
      sectorEtf,
      spy,
      qqq,
      iwm,
      sector,
    };
  }

  /**
   * Prefetch regime indexes + unique sector ETFs for a confirm batch (one round trip each).
   */
  async warmForSymbols(symbols: string[]): Promise<void> {
    await this.getRegime();
    const etfs = [
      ...new Set(
        symbols.map((s) => sectorEtfFor(s)).filter((etf) => etf !== "SPY"),
      ),
    ];
    if (etfs.length === 0) return;
    const now = Date.now();
    if (this.marketData.getSnapshots) {
      try {
        const batch = await this.marketData.getSnapshots(etfs);
        const got = new Set<string>();
        for (const s of batch) {
          this.sectorCache.set(s.symbol, { at: now, value: s });
          got.add(s.symbol);
        }
        for (const etf of etfs) {
          if (!got.has(etf)) this.sectorCache.set(etf, { at: now, value: null });
        }
        return;
      } catch {
        // fall through to sequential
      }
    }
    for (const etf of etfs) {
      await this.cachedSectorSnapshot(etf);
    }
  }

  private async cachedSectorSnapshot(symbol: string): Promise<MarketSnapshot | null> {
    const now = Date.now();
    const hit = this.sectorCache.get(symbol);
    if (hit && now - hit.at < SECTOR_TTL_MS) return hit.value;
    let value: MarketSnapshot | null = null;
    if (this.marketData.getSnapshots) {
      try {
        const batch = await this.marketData.getSnapshots([symbol]);
        value = batch[0] ?? null;
      } catch {
        value = await this.safeSnapshot(symbol);
      }
    } else {
      value = await this.safeSnapshot(symbol);
    }
    this.sectorCache.set(symbol, { at: now, value });
    return value;
  }

  private async safeSnapshot(symbol: string): Promise<MarketSnapshot | null> {
    try {
      return await this.marketData.getSnapshot(symbol);
    } catch {
      return null;
    }
  }
}
