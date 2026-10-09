export interface Bar {
  symbol: string;
  timeframe: "1Min" | "5Min" | "15Min" | "1Day";
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
  /** When this snapshot was assembled locally */
  receivedAt: Date;
  /** Latest upstream market timestamp observed */
  marketTimestamp: Date | null;
}

export interface FreshnessResult {
  ok: boolean;
  ageMs: number;
  maxAgeMs: number;
  reason: string;
}
