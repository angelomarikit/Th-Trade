import { analyzeStock } from "@wulu/actionable";
import type { StockDecisionOutput } from "@wulu/actionable";
import { resolveAlpacaFeed } from "@wulu/market-data";
import type { MarketDataProvider } from "@wulu/market-data";
import { AlpacaMarketDataProvider } from "@wulu/market-data";

export const DEFAULT_DIAGNOSTIC_SYMBOLS = [
  "AAPL",
  "MSFT",
  "NVDA",
  "AMZN",
  "META",
  "GOOGL",
  "AMD",
  "TSLA",
  "JPM",
  "SPY",
] as const;

export interface SymbolDiagnostic {
  symbol: string;
  decision: StockDecisionOutput;
  diagnosis: {
    rootCause: "market_conditions" | "stale_data" | "calculation_gap" | "excessive_filters" | "strategy_conflict" | "feed_limitation" | "ok_candidate";
    summary: string;
  };
}

function inferRootCause(decision: StockDecisionOutput): SymbolDiagnostic["diagnosis"] {
  if (decision.finalAction === "BUY_CANDIDATE" && decision.executionEligible) {
    return { rootCause: "ok_candidate", summary: "At least one strategy passed all mandatory gates." };
  }
  if (!decision.volumeFeedComparable) {
    return {
      rootCause: "feed_limitation",
      summary: "Volume-sensitive strategies disabled — configure ALPACA_DATA_FEED=sip with entitlement.",
    };
  }
  if (decision.finalAction === "DATA_UNAVAILABLE") {
    return { rootCause: "stale_data", summary: decision.decisionReason };
  }
  const blocking = decision.conditionsMissing;
  if (blocking.some((b) => /history|bars|atr|ema/i.test(b))) {
    return { rootCause: "calculation_gap", summary: decision.decisionReason };
  }
  const waiters = decision.strategiesEvaluated.filter((s) => s.action === "WAIT_FOR_TRIGGER");
  const skippers = decision.strategiesEvaluated.filter((s) => s.action === "SKIP");
  if (waiters.length > 0 && decision.finalAction === "WAIT_FOR_TRIGGER") {
    return {
      rootCause: "market_conditions",
      summary: waiters[0]?.waitTrigger ?? decision.decisionReason,
    };
  }
  if (skippers.length === decision.strategiesEvaluated.length) {
    return { rootCause: "excessive_filters", summary: decision.decisionReason };
  }
  return { rootCause: "market_conditions", summary: decision.decisionReason };
}

export async function runSipDiagnostic(input: {
  market: MarketDataProvider;
  symbols?: string[];
  spreadPct?: number | null;
}): Promise<{
  feed: string;
  volumeFeedComparable: boolean;
  symbols: SymbolDiagnostic[];
}> {
  const feed =
    input.market instanceof AlpacaMarketDataProvider
      ? input.market.activeFeed
      : resolveAlpacaFeed();
  const volumeFeedComparable = feed === "sip";
  const symbols = input.symbols?.length ? input.symbols : [...DEFAULT_DIAGNOSTIC_SYMBOLS];
  const spyDaily = await input.market.getBars({
    symbol: "SPY",
    timeframe: "1Day",
    limit: 260,
    regularHoursOnly: false,
  });

  const out: SymbolDiagnostic[] = [];
  for (const symbol of symbols) {
    const [stockDaily, snap] = await Promise.all([
      input.market.getBars({
        symbol,
        timeframe: "1Day",
        limit: 260,
        regularHoursOnly: false,
      }),
      input.market.getSnapshot(symbol),
    ]);
    const decision = analyzeStock({
      symbol,
      dataFeed: feed,
      lastPrice: snap.lastPrice,
      stockDaily,
      spyDaily,
      bars5m: snap.bars5m,
      bars15m: snap.bars15m,
      volumeFeedComparable,
      spreadPct: input.spreadPct,
      paperAccount: {
        equity: 100_000,
        buyingPower: 50_000,
        openPositionCount: 0,
        openPortfolioRiskPct: 0,
        hasOpenPositionInSymbol: false,
        hasPendingOrderInSymbol: false,
      },
    });
    out.push({ symbol, decision, diagnosis: inferRootCause(decision) });
  }
  return { feed, volumeFeedComparable, symbols: out };
}
