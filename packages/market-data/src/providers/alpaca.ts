import type { MarketDataProvider } from "../MarketDataProvider.js";
import type { Bar, DiscoverySnapshot, MarketSnapshot, Quote } from "../types.js";
import { loadAlpacaCredentials } from "../credentials.js";
import {
  fetchAlpacaWithRetry,
  gateOptsFromEnv,
  getSharedAlpacaGate,
  type AlpacaRequestGate,
} from "../rateLimit.js";

export interface AlpacaMarketDataConfig {
  apiKeyId: string;
  apiSecretKey: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  /** iex is common on free/paper data; sip if entitled */
  feed?: "iex" | "sip";
  /** Override shared process gate (tests). */
  requestGate?: AlpacaRequestGate;
  maxRetries?: number;
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
  private readonly gate: AlpacaRequestGate;
  private readonly maxRetries: number;

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
    const envOpts = gateOptsFromEnv();
    this.gate = config.requestGate ?? getSharedAlpacaGate(envOpts);
    this.maxRetries = config.maxRetries ?? envOpts.maxRetries ?? 4;
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
    // Sequential on purpose — parallel bursts were a primary source of Alpaca 429s
    // under six-symbol monitoring. The shared gate also spaces requests globally.
    const quote = await this.getQuote(sym);
    // Skip trade when quote mid is usable — saves one gated call without changing
    // evaluateSetup inputs (still have quote + full bars).
    const trade =
      quote && quote.bid > 0 && quote.ask > 0
        ? null
        : await this.getLatestTrade(sym);
    const bars1m = await this.getBars({ symbol: sym, timeframe: "1Min", limit: 120 });
    const bars5m = await this.getBars({ symbol: sym, timeframe: "5Min", limit: 78 });

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

  /**
   * Confirm-path batch: 1 snapshot chunk + multi-symbol 1m/5m bars (≈3 HTTP calls
   * for a typical confirm set instead of ~24 sequential per-symbol calls).
   */
  async getSnapshots(symbols: string[]): Promise<MarketSnapshot[]> {
    const unique = [...new Set(symbols.map((s) => s.trim().toUpperCase()).filter(Boolean))];
    if (unique.length === 0) return [];

    const quoteBySymbol = new Map<
      string,
      { quote: Quote | null; tradePrice: number | null; tradeTs: Date | null; lastPrice: number | null }
    >();
    const chunkSize = Math.max(1, Number(process.env.ALPACA_SNAPSHOT_CHUNK ?? 40) || 40);
    const now = new Date();

    for (let i = 0; i < unique.length; i += chunkSize) {
      const chunk = unique.slice(i, i + chunkSize);
      const url =
        `${this.baseUrl}/v2/stocks/snapshots?symbols=${encodeURIComponent(chunk.join(","))}` +
        `&feed=${this.feed}`;
      const data = await this.getJson<Record<string, AlpacaStockSnapshot>>(url);
      for (const sym of chunk) {
        const snap = data[sym];
        if (!snap) {
          quoteBySymbol.set(sym, {
            quote: null,
            tradePrice: null,
            tradeTs: null,
            lastPrice: null,
          });
          continue;
        }
        const q = snap.latestQuote;
        const quote: Quote | null =
          q?.bp != null &&
          q?.ap != null &&
          q.t &&
          q.bp > 0 &&
          q.ap > 0 &&
          q.ap >= q.bp
            ? {
                symbol: sym,
                bid: q.bp,
                ask: q.ap,
                bidSize: undefined,
                askSize: undefined,
                timestamp: new Date(q.t),
              }
            : null;
        const tradePrice = snap.latestTrade?.p ?? null;
        const tradeTs = snap.latestTrade?.t ? new Date(snap.latestTrade.t) : null;
        const mid =
          quote != null
            ? (quote.bid + quote.ask) / 2
            : (tradePrice ?? snap.minuteBar?.c ?? snap.dailyBar?.c ?? null);
        quoteBySymbol.set(sym, { quote, tradePrice, tradeTs, lastPrice: mid });
      }
    }

    const bars1mBy = await this.getMultiBars(unique, "1Min", 120);
    const bars5mBy = await this.getMultiBars(unique, "5Min", 78);

    const out: MarketSnapshot[] = [];
    for (const sym of unique) {
      const meta = quoteBySymbol.get(sym);
      const bars1m = bars1mBy.get(sym) ?? [];
      const bars5m = bars5mBy.get(sym) ?? [];
      const lastBar = bars1m.at(-1) ?? bars5m.at(-1);
      const lastPrice = meta?.lastPrice ?? lastBar?.close ?? 0;
      if (!(lastPrice > 0)) continue;
      out.push({
        symbol: sym,
        lastPrice,
        quote: meta?.quote ?? null,
        bars1m,
        bars5m,
        receivedAt: now,
        marketTimestamp:
          meta?.quote?.timestamp ?? meta?.tradeTs ?? lastBar?.timestamp ?? null,
      });
    }
    return out;
  }

  /** Alpaca multi-symbol bars — one gated HTTP call per timeframe (with page follow). */
  private async getMultiBars(
    symbols: string[],
    timeframe: Bar["timeframe"],
    limit: number,
  ): Promise<Map<string, Bar[]>> {
    const result = new Map<string, Bar[]>();
    if (symbols.length === 0) return result;

    const tf = mapTimeframe(timeframe);
    const end = new Date();
    const start = new Date(end.getTime() - lookbackForTimeframe(timeframe, limit));
    const tfMs = timeframeMs(timeframe);
    let pageToken: string | null = null;
    let pages = 0;

    do {
      const params = new URLSearchParams({
        symbols: symbols.join(","),
        timeframe: tf,
        limit: String(limit),
        adjustment: "raw",
        feed: this.feed,
        sort: "asc",
        start: start.toISOString(),
        end: end.toISOString(),
      });
      if (pageToken) params.set("page_token", pageToken);
      const url = `${this.baseUrl}/v2/stocks/bars?${params}`;
      const data = await this.getJson<{
        bars?: Record<string, AlpacaBar[] | null> | null;
        next_page_token?: string | null;
      }>(url);

      const now = Date.now();
      for (const [sym, rawBars] of Object.entries(data.bars ?? {})) {
        const mapped = (rawBars ?? []).map((b) => {
          const ts = new Date(b.t);
          const barEnd = ts.getTime() + tfMs;
          return {
            symbol: sym.toUpperCase(),
            timeframe,
            timestamp: ts,
            open: b.o,
            high: b.h,
            low: b.l,
            close: b.c,
            volume: b.v,
            vwap: b.vw,
            completed: barEnd <= now,
          } satisfies Bar;
        });
        const prev = result.get(sym.toUpperCase()) ?? [];
        result.set(sym.toUpperCase(), prev.concat(mapped));
      }
      pageToken = data.next_page_token ?? null;
      pages += 1;
    } while (pageToken && pages < 4);

    // Trim to requested limit (keep newest)
    for (const [sym, bars] of result) {
      if (bars.length > limit) {
        result.set(sym, bars.slice(-limit));
      }
    }
    return result;
  }

  /**
   * Batch discovery snapshots — one HTTP call per chunk (default 40 symbols).
   * Does not pull full 1m/5m history; use getSnapshot / getSnapshots for confirmation.
   */
  async getDiscoverySnapshots(symbols: string[]): Promise<DiscoverySnapshot[]> {
    const unique = [...new Set(symbols.map((s) => s.trim().toUpperCase()).filter(Boolean))];
    const chunkSize = Math.max(1, Number(process.env.ALPACA_SNAPSHOT_CHUNK ?? 40) || 40);
    const out: DiscoverySnapshot[] = [];
    const now = new Date();

    for (let i = 0; i < unique.length; i += chunkSize) {
      const chunk = unique.slice(i, i + chunkSize);
      const url =
        `${this.baseUrl}/v2/stocks/snapshots?symbols=${encodeURIComponent(chunk.join(","))}` +
        `&feed=${this.feed}`;
      const data = await this.getJson<Record<string, AlpacaStockSnapshot>>(url);
      for (const sym of chunk) {
        const snap = data[sym];
        if (!snap) continue;
        const mapped = mapAlpacaDiscoverySnapshot(sym, snap, now);
        if (mapped) out.push(mapped);
      }
    }
    return out;
  }

  private async getJson<T>(url: string): Promise<T> {
    const res = await fetchAlpacaWithRetry(
      this.fetchImpl,
      url,
      {
        headers: {
          "APCA-API-KEY-ID": this.config.apiKeyId,
          "APCA-API-SECRET-KEY": this.config.apiSecretKey,
          Accept: "application/json",
        },
      },
      {
        gate: this.gate,
        maxRetries: this.maxRetries,
      },
    );
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Alpaca market data HTTP ${res.status}: ${body.slice(0, 200)}`);
    }
    return (await res.json()) as T;
  }
}

interface AlpacaStockSnapshot {
  latestTrade?: { p?: number; t?: string };
  latestQuote?: { bp?: number; ap?: number; t?: string };
  minuteBar?: { o?: number; h?: number; l?: number; c?: number; v?: number; t?: string };
  dailyBar?: { o?: number; h?: number; l?: number; c?: number; v?: number; t?: string };
  prevDailyBar?: { o?: number; h?: number; l?: number; c?: number; v?: number; t?: string };
}

function mapAlpacaDiscoverySnapshot(
  symbol: string,
  snap: AlpacaStockSnapshot,
  receivedAt: Date,
): DiscoverySnapshot | null {
  const lastPrice =
    snap.latestTrade?.p ??
    (snap.latestQuote?.bp != null && snap.latestQuote?.ap != null
      ? (snap.latestQuote.bp + snap.latestQuote.ap) / 2
      : null) ??
    snap.minuteBar?.c ??
    snap.dailyBar?.c ??
    null;
  if (lastPrice == null || !(lastPrice > 0)) return null;

  const tsRaw =
    snap.latestTrade?.t ?? snap.latestQuote?.t ?? snap.minuteBar?.t ?? snap.dailyBar?.t ?? null;

  return {
    symbol,
    lastPrice,
    prevClose: snap.prevDailyBar?.c ?? null,
    dayOpen: snap.dailyBar?.o ?? null,
    dayHigh: snap.dailyBar?.h ?? null,
    dayLow: snap.dailyBar?.l ?? null,
    dayVolume: snap.dailyBar?.v ?? null,
    prevDayVolume: snap.prevDailyBar?.v ?? null,
    minuteClose: snap.minuteBar?.c ?? null,
    minuteVolume: snap.minuteBar?.v ?? null,
    bid: snap.latestQuote?.bp ?? null,
    ask: snap.latestQuote?.ap ?? null,
    marketTimestamp: tsRaw ? new Date(tsRaw) : null,
    receivedAt,
  };
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
