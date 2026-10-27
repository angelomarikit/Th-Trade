import { analyzeStock } from "@wulu/actionable";
import { AlpacaMarketDataProvider, resolveAlpacaFeed, type MarketDataProvider } from "@wulu/market-data";

export async function handleActionableAnalyze(input: {
  ticker: string;
  market: MarketDataProvider;
  spreadPct?: number | null;
  orbEnabled?: boolean;
}): Promise<ReturnType<typeof analyzeStock>> {
  const symbol = input.ticker.toUpperCase();
  const [stockDaily, spyDaily, snap] = await Promise.all([
    input.market.getBars({ symbol, timeframe: "1Day", limit: 260, regularHoursOnly: false }),
    input.market.getBars({ symbol: "SPY", timeframe: "1Day", limit: 260, regularHoursOnly: false }),
    input.market.getSnapshot(symbol),
  ]);

  const feed =
    input.market instanceof AlpacaMarketDataProvider
      ? input.market.activeFeed
      : resolveAlpacaFeed();
  return analyzeStock({
    symbol,
    dataFeed: feed,
    lastPrice: snap.lastPrice,
    stockDaily,
    spyDaily,
    bars5m: snap.bars5m,
    bars15m: snap.bars15m,
    volumeFeedComparable: feed === "sip",
    spreadPct: input.spreadPct,
    openingRangeBreakoutEnabled: input.orbEnabled === true,
  });
}
