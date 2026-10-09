import type { MarketDataProvider } from "../MarketDataProvider.js";
import type { Bar, MarketSnapshot, Quote } from "../types.js";

export interface MockMarketScenario {
  symbol: string;
  side: "LONG" | "SHORT";
  /** Base price around which bars are built */
  basePrice: number;
  /** If true, last 5m bar is still forming */
  incompleteFiveMin?: boolean;
  /** Relative volume roughly high */
  highVolume?: boolean;
  /** Price above/below VWAP bias */
  aboveVwap?: boolean;
  spreadPct?: number;
  staleMs?: number;
  now?: Date;
}

/**
 * Deterministic bars for offline confirmation tests.
 */
export class MockMarketDataProvider implements MarketDataProvider {
  readonly name = "mock";

  constructor(private readonly scenario: MockMarketScenario) {}

  async getQuote(symbol: string): Promise<Quote | null> {
    const snap = await this.getSnapshot(symbol);
    return snap.quote;
  }

  async getBars(query: {
    symbol: string;
    timeframe: Bar["timeframe"];
    limit?: number;
  }): Promise<Bar[]> {
    const snap = await this.getSnapshot(query.symbol);
    return query.timeframe === "5Min" ? snap.bars5m : snap.bars1m;
  }

  async getSnapshot(symbol: string): Promise<MarketSnapshot> {
    const now = this.scenario.now ?? new Date();
    const sym = symbol.toUpperCase();
    const base = this.scenario.basePrice;
    const above = this.scenario.aboveVwap ?? true;
    const highVol = this.scenario.highVolume ?? true;
    const bars1m = buildBars(sym, "1Min", base, above, highVol, now, 60, true);
    const bars5m = buildBars(
      sym,
      "5Min",
      base,
      above,
      highVol,
      now,
      24,
      !(this.scenario.incompleteFiveMin ?? false),
    );

    if (this.scenario.incompleteFiveMin && bars5m.length) {
      const last = bars5m[bars5m.length - 1]!;
      last.completed = false;
    }

    const last = bars1m.at(-1)!;
    const mid = last.close;
    const spreadPct = this.scenario.spreadPct ?? 0.05;
    const half = (mid * spreadPct) / 100 / 2;
    const staleMs = this.scenario.staleMs ?? 5_000;
    const quoteTs = new Date(now.getTime() - staleMs);

    const quote: Quote = {
      symbol: sym,
      bid: mid - half,
      ask: mid + half,
      timestamp: quoteTs,
    };

    return {
      symbol: sym,
      lastPrice: mid,
      quote,
      bars1m,
      bars5m,
      receivedAt: now,
      marketTimestamp: quoteTs,
    };
  }
}

function buildBars(
  symbol: string,
  timeframe: Bar["timeframe"],
  base: number,
  aboveVwap: boolean,
  highVol: boolean,
  now: Date,
  count: number,
  allCompleted: boolean,
): Bar[] {
  const tfMs = timeframe === "5Min" ? 300_000 : 60_000;
  const bars: Bar[] = [];
  const drift = aboveVwap ? 0.15 : -0.15;

  for (let i = count; i >= 1; i--) {
    const ts = new Date(now.getTime() - i * tfMs);
    const progress = (count - i) / count;
    const close = base + drift * progress + (aboveVwap ? 0.05 : -0.05);
    const open = close - (aboveVwap ? 0.03 : -0.03);
    const high = Math.max(open, close) + 0.08;
    const low = Math.min(open, close) - 0.08;
    // Newer bars (low i) get higher volume so RVOL confirmation can PASS in fixtures
    const volume = (highVol ? 40_000 : 10_000) * (1 + progress * (highVol ? 3 : 0.2));
    bars.push({
      symbol,
      timeframe,
      timestamp: ts,
      open,
      high,
      low,
      close,
      volume,
      vwap: (high + low + close) / 3,
      completed: allCompleted || i > 1,
    });
  }
  return bars;
}
