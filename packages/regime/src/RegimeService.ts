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

/**
 * Fetches index snapshots and builds regime + alignment for a symbol/side.
 */
export class RegimeService {
  constructor(private readonly marketData: MarketDataProvider) {}

  async getRegime(): Promise<{
    regime: RegimeSnapshot;
    spy: MarketSnapshot;
    qqq: MarketSnapshot | null;
    iwm: MarketSnapshot | null;
  }> {
    const [spy, qqq, iwm] = await Promise.all([
      this.marketData.getSnapshot("SPY"),
      this.safeSnapshot("QQQ"),
      this.safeSnapshot("IWM"),
    ]);
    const regime = evaluateMarketRegime({ spy, qqq, iwm });
    return { regime, spy, qqq, iwm };
  }

  async getContextForSymbol(
    symbol: string,
    side: TradeSide,
    symbolSnapshot: MarketSnapshot,
  ): Promise<SymbolRegimeContext> {
    const { regime, spy, qqq, iwm } = await this.getRegime();
    const sectorEtf = sectorEtfFor(symbol);
    const sector =
      sectorEtf === "SPY" ? spy : await this.safeSnapshot(sectorEtf);

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

  private async safeSnapshot(symbol: string): Promise<MarketSnapshot | null> {
    try {
      return await this.marketData.getSnapshot(symbol);
    } catch {
      return null;
    }
  }
}
