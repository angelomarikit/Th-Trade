export interface Bar {
  symbol: string;
  timeframe: "1Min" | "5Min" | "15Min" | "1Hour" | "1Day";
  /** Bar open time (UTC) */
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  vwap?: number;
  /** True when exchange has closed this bar */
  completed: boolean;
}

export interface Quote {
  symbol: string;
  bid: number;
  ask: number;
  bidSize?: number;
  askSize?: number;
  timestamp: Date;
}

export interface TradeTape {
  symbol: string;
  price: number;
  size: number;
  timestamp: Date;
}

export interface MarketSnapshot {
  symbol: string;
  lastPrice: number;
  quote: Quote | null;
  bars1m: Bar[];
  bars5m: Bar[];
  /** Native 15-minute RTH bars when provider fetched them. */
  bars15m: Bar[];
  /** Native 1-hour RTH bars when provider fetched them. */
  bars1h: Bar[];
  /** When this snapshot was assembled locally */
  receivedAt: Date;
  /** Latest upstream market timestamp observed */
  marketTimestamp: Date | null;
  /** How lastPrice was chosen — bar close is reference-only for entry. */
  priceSource?: "quote_mid" | "rth_bar_close" | "trade" | "unknown";
}

export interface FreshnessResult {
  ok: boolean;
  ageMs: number;
  maxAgeMs: number;
  reason: string;
}

/**
 * Lightweight multi-symbol snapshot for Phase 5 discovery (not full confirmation bars).
 * Sourced from Alpaca /v2/stocks/snapshots — IEX volume is approximate.
 */
export interface DiscoverySnapshot {
  symbol: string;
  lastPrice: number;
  /** Prior regular session close when available */
  prevClose: number | null;
  /** Session open (daily bar) when available */
  dayOpen: number | null;
  dayHigh: number | null;
  dayLow: number | null;
  dayVolume: number | null;
  prevDayVolume: number | null;
  /** Latest minute bar close */
  minuteClose: number | null;
  minuteVolume: number | null;
  bid: number | null;
  ask: number | null;
  marketTimestamp: Date | null;
  receivedAt: Date;
}
