/**
 * Coarse sector ETF map for alignment checks.
 * Unknown tickers fall back to SPY as broad market proxy.
 */
export const SECTOR_ETF_BY_TICKER: Record<string, string> = {
  NVDA: "SMH",
  AMD: "SMH",
  AVGO: "SMH",
  TSM: "SMH",
  INTC: "SMH",
  MU: "SMH",
  AAPL: "XLK",
  MSFT: "XLK",
  GOOGL: "XLK",
  GOOG: "XLK",
  META: "XLK",
  AMZN: "XLY",
  TSLA: "XLY",
  NFLX: "XLC",
  JPM: "XLF",
  BAC: "XLF",
  GS: "XLF",
  XOM: "XLE",
  CVX: "XLE",
  UNH: "XLV",
  JNJ: "XLV",
  CAT: "XLI",
  BA: "XLI",
  PG: "XLP",
  KO: "XLP",
  LIN: "XLB",
  NEE: "XLU",
  AMT: "XLRE",
};

export function sectorEtfFor(symbol: string): string {
  return SECTOR_ETF_BY_TICKER[symbol.toUpperCase()] ?? "SPY";
}
