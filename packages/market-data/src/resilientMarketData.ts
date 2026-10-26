import type { MarketDataProvider } from "./MarketDataProvider.js";
import type { Bar, DiscoverySnapshot, MarketSnapshot, Quote } from "./types.js";
import type { BarsQuery } from "./MarketDataProvider.js";

function emptyMarketSnapshot(symbol: string): MarketSnapshot {
  return {
    symbol: symbol.toUpperCase(),
    lastPrice: 0,
    quote: null,
    bars1m: [],
    bars5m: [],
    bars15m: [],
    bars1h: [],
    receivedAt: new Date(),
    marketTimestamp: null,
    priceSource: "unknown",
  };
}

export function isAlpacaMarketDataAuthError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    /Alpaca market data HTTP (401|403)\b/.test(msg) ||
    /401 Authorization Required/i.test(msg)
  );
}

/** When Alpaca keys are wrong, return empty data instead of crashing the API process. */
export function wrapMarketDataAuthSoftFail(inner: MarketDataProvider): MarketDataProvider {
  let warned = false;
  const warn = (method: string) => {
    if (warned) return;
    warned = true;
    console.warn(
      `[market-data] Alpaca auth failed during ${method} — soft-fail active. ` +
        `Verify ALPACA_API_KEY_ID, ALPACA_API_SECRET_KEY, and ALPACA_DATA_BASE_URL on the host.`,
    );
  };

  const onAuthFail = (method: string, symbol?: string): [] | null | MarketSnapshot => {
    warn(method);
    if (method === "getBars") return [];
    if (method === "getQuote") return null;
    if (method === "getDiscoverySnapshots") return [];
    if (method === "getSnapshots") return [];
    if (method === "getSnapshot") return emptyMarketSnapshot(symbol ?? "UNKNOWN");
    return [];
  };

  return {
    name: `${inner.name}-auth-soft-fail`,
    async getQuote(symbol: string): Promise<Quote | null> {
      try {
        return await inner.getQuote(symbol);
      } catch (err) {
        if (isAlpacaMarketDataAuthError(err)) return onAuthFail("getQuote") as null;
        throw err;
      }
    },
    async getBars(query: BarsQuery): Promise<Bar[]> {
      try {
        return await inner.getBars(query);
      } catch (err) {
        if (isAlpacaMarketDataAuthError(err)) return onAuthFail("getBars") as [];
        throw err;
      }
    },
    async getSnapshot(symbol: string): Promise<MarketSnapshot> {
      try {
        return await inner.getSnapshot(symbol);
      } catch (err) {
        if (isAlpacaMarketDataAuthError(err)) return onAuthFail("getSnapshot", symbol) as MarketSnapshot;
        throw err;
      }
    },
    async getDiscoverySnapshots(symbols: string[]): Promise<DiscoverySnapshot[]> {
      if (!inner.getDiscoverySnapshots) return [];
      try {
        return await inner.getDiscoverySnapshots(symbols);
      } catch (err) {
        if (isAlpacaMarketDataAuthError(err)) return onAuthFail("getDiscoverySnapshots") as [];
        throw err;
      }
    },
    async getSnapshots(symbols: string[]): Promise<MarketSnapshot[]> {
      if (!inner.getSnapshots) return [];
      try {
        return await inner.getSnapshots(symbols);
      } catch (err) {
        if (isAlpacaMarketDataAuthError(err)) return onAuthFail("getSnapshots") as [];
        throw err;
      }
    },
  };
}

export function marketDataAuthSoftFailEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const flag = (env.MARKET_DATA_AUTH_SOFT_FAIL ?? "").trim().toLowerCase();
  if (flag === "0" || flag === "false") return false;
  if (flag === "1" || flag === "true") return true;
  // Default ON: bad Alpaca keys must not crash the API process (502 for everyone).
  return true;
}
