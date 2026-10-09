import type { MarketDataProvider } from "../MarketDataProvider.js";
import type { Bar, MarketSnapshot, Quote } from "../types.js";
import { loadAlpacaCredentials } from "../credentials.js";

export interface AlpacaMarketDataConfig {
  apiKeyId: string;
  apiSecretKey: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  /** iex is common on free/paper data; sip if entitled */
  feed?: "iex" | "sip";
}

interface AlpacaBar {
  t: string;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
  vw?: number;
  n?: number;
}

interface AlpacaQuote {
  t?: string;
  bp?: number;
  ap?: number;
  bs?: number;
  as?: number;
  // latest quote sometimes nested
}

/**
 * Official Alpaca market data — quotes/bars only.
 * Never places orders.
 */
export class AlpacaMarketDataProvider implements MarketDataProvider {
  readonly name = "alpaca";
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly feed: "iex" | "sip";

  constructor(private readonly config: AlpacaMarketDataConfig) {
    if (!config.apiKeyId || !config.apiSecretKey) {
      const idSet = Boolean((process.env.ALPACA_API_KEY_ID ?? "").trim());
      const secretSet = Boolean((process.env.ALPACA_API_SECRET_KEY ?? "").trim());
      throw new Error(
        `AlpacaMarketDataProvider requires API key and secret. ` +
          `Env check: ALPACA_API_KEY_ID=${idSet ? "set" : "MISSING"}, ` +
          `ALPACA_API_SECRET_KEY=${secretSet ? "set" : "MISSING"}. ` +
          `On Railway → Variables, add both exact names (no quotes), then Redeploy.`,
      );
    }
    this.baseUrl = (config.baseUrl ?? "https://data.alpaca.markets").replace(/\/$/, "");
    this.fetchImpl = config.fetchImpl ?? fetch;
    this.feed = config.feed ?? "iex";
  }

  async getQuote(symbol: string): Promise<Quote | null> {
    const url = `${this.baseUrl}/v2/stocks/${encodeURIComponent(symbol)}/quotes/latest?feed=${this.feed}`;
    const data = await this.getJson<{ quote?: AlpacaQuote }>(url);
    const q = data.quote;
    if (!q || q.bp == null || q.ap == null || !q.t) return null;
    // Closed session / halted: Alpaca may return 0x0 — treat as no usable NBBO
    if (q.bp <= 0 || q.ap <= 0 || q.ap < q.bp) return null;
    return {
      symbol: symbol.toUpperCase(),
      bid: q.bp,
      ask: q.ap,
      bidSize: q.bs,
      askSize: q.as,
      timestamp: new Date(q.t),
    };
  }

  async getLatestTrade(symbol: string): Promise<{ price: number; timestamp: Date } | null> {
    const url = `${this.baseUrl}/v2/stocks/${encodeURIComponent(symbol)}/trades/latest?feed=${this.feed}`;
    const data = await this.getJson<{ trade?: { p?: number; t?: string } }>(url);
    const t = data.trade;
    if (!t?.p || !t.t) return null;
    return { price: t.p, timestamp: new Date(t.t) };
  }


  async getBars(query: {
    symbol: string;
    timeframe: Bar["timeframe"];
    limit?: number;
  }): Promise<Bar[]> {
    const limit = query.limit ?? 100;
    const tf = mapTimeframe(query.timeframe);
    /** Explicit window so closed/overnight sessions still return history (Alpaca may omit bars without start). */
    const end = new Date();
    const lookbackMs = lookbackForTimeframe(query.timeframe, limit);
    const start = new Date(end.getTime() - lookbackMs);
    const params = new URLSearchParams({
      timeframe: tf,
      limit: String(limit),
      adjustment: "raw",
      feed: this.feed,
      sort: "asc",
      start: start.toISOString(),
      end: end.toISOString(),
    });
    const url =
      `${this.baseUrl}/v2/stocks/${encodeURIComponent(query.symbol)}/bars?${params}`;
    const data = await this.getJson<{ bars?: AlpacaBar[] | null }>(url);
    const bars = data.bars ?? [];
    const now = Date.now();
    const tfMs = timeframeMs(query.timeframe);

    return bars.map((b) => {
      const ts = new Date(b.t);
      const end = ts.getTime() + tfMs;
      return {
        symbol: query.symbol.toUpperCase(),
        timeframe: query.timeframe,
        timestamp: ts,
        open: b.o,
        high: b.h,
        low: b.l,
        close: b.c,
        volume: b.v,
        vwap: b.vw,
        completed: end <= now,
      };
    });
  }

  async getSnapshot(symbol: string): Promise<MarketSnapshot> {
    const sym = symbol.toUpperCase();
    const [quote, trade, bars1m, bars5m] = await Promise.all([
      this.getQuote(sym),
      this.getLatestTrade(sym),
      this.getBars({ symbol: sym, timeframe: "1Min", limit: 120 }),
      this.getBars({ symbol: sym, timeframe: "5Min", limit: 78 }),
    ]);

    const lastBar = bars1m.at(-1) ?? bars5m.at(-1);
    const lastPrice =
      quote && quote.bid > 0 && quote.ask > 0
        ? (quote.bid + quote.ask) / 2
        : (trade?.price ?? lastBar?.close ?? 0);

    const marketTimestamp =
      quote?.timestamp ??
      trade?.timestamp ??
      lastBar?.timestamp ??
      null;

    return {
      symbol: sym,
      lastPrice,
      quote,
      bars1m,
      bars5m,
      receivedAt: new Date(),
      marketTimestamp,
    };
  }


  private async getJson<T>(url: string): Promise<T> {
    const res = await this.fetchImpl(url, {
      headers: {
        "APCA-API-KEY-ID": this.config.apiKeyId,
        "APCA-API-SECRET-KEY": this.config.apiSecretKey,
        Accept: "application/json",
      },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Alpaca market data HTTP ${res.status}: ${body.slice(0, 200)}`);
    }
    return (await res.json()) as T;
  }
}

export function createAlpacaMarketDataFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): AlpacaMarketDataProvider {
  const creds = loadAlpacaCredentials(env);
  return new AlpacaMarketDataProvider({
    apiKeyId: creds.apiKeyId,
    apiSecretKey: creds.apiSecretKey,
    baseUrl: creds.dataBaseUrl,
    feed: (env.ALPACA_DATA_FEED as "iex" | "sip" | undefined) ?? "iex",
  });
}

function mapTimeframe(tf: Bar["timeframe"]): string {
  switch (tf) {
    case "1Min":
      return "1Min";
    case "5Min":
      return "5Min";
    case "15Min":
      return "15Min";
    case "1Day":
      return "1Day";
  }
}

function timeframeMs(tf: Bar["timeframe"]): number {
  switch (tf) {
    case "1Min":
      return 60_000;
    case "5Min":
      return 300_000;
    case "15Min":
      return 900_000;
    case "1Day":
      return 86_400_000;
  }
}

function lookbackForTimeframe(tf: Bar["timeframe"], limit: number): number {
  const pad = 1.5;
  switch (tf) {
    case "1Min":
      return Math.max(2 * 86_400_000, Math.ceil(limit * 60_000 * pad));
    case "5Min":
      return Math.max(5 * 86_400_000, Math.ceil(limit * 300_000 * pad));
    case "15Min":
      return Math.max(10 * 86_400_000, Math.ceil(limit * 900_000 * pad));
    case "1Day":
      return Math.max(180 * 86_400_000, Math.ceil(limit * 86_400_000 * pad));
  }
}
