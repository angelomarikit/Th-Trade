import type { Bar, DiscoverySnapshot, MarketSnapshot, Quote } from "./types.js";

export interface BarsQuery {
  symbol: string;
  timeframe: Bar["timeframe"];
  limit?: number;
  /** If true, mark in-progress bar as incomplete */
  feed?: "iex" | "sip";
}

export interface MarketDataProvider {
  readonly name: string;
  getQuote(symbol: string): Promise<Quote | null>;
  getBars(query: BarsQuery): Promise<Bar[]>;
  getSnapshot(symbol: string): Promise<MarketSnapshot>;
  /**
   * Cheap multi-symbol discovery snapshots (batch when provider supports it).
   * Default implementations may fall back to sequential getSnapshot mapping.
   */
  getDiscoverySnapshots?(symbols: string[]): Promise<DiscoverySnapshot[]>;
}
