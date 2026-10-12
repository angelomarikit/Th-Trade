/**
 * Coarse sector ETF map for alignment checks.
 * Unknown tickers fall back to SPY as broad market proxy.
 */
export const SECTOR_ETF_BY_TICKER: Record<string, string> = {
  // Semis / hardware
  NVDA: "SMH",
  AMD: "SMH",
  AVGO: "SMH",
  TSM: "SMH",
  INTC: "SMH",
  MU: "SMH",
  QCOM: "SMH",
  AMAT: "SMH",
  LRCX: "SMH",
  KLAC: "SMH",
  ASML: "SMH",
  ARM: "SMH",
  SMCI: "SMH",
  // Tech / software
  AAPL: "XLK",
  MSFT: "XLK",
  GOOGL: "XLK",
  GOOG: "XLK",
  META: "XLK",
  CRM: "XLK",
  ORCL: "XLK",
  ADBE: "XLK",
  NOW: "XLK",
  SNOW: "XLK",
  PANW: "XLK",
  CRWD: "XLK",
  PLTR: "XLK",
  // Consumer discretionary / internet
  AMZN: "XLY",
  TSLA: "XLY",
  HD: "XLY",
  NKE: "XLY",
  SBUX: "XLY",
  MCD: "XLY",
  RIVN: "XLY",
  // Communication
  NFLX: "XLC",
  DIS: "XLC",
  // Financials
  JPM: "XLF",
  BAC: "XLF",
  GS: "XLF",
  MS: "XLF",
  C: "XLF",
  WFC: "XLF",
  BLK: "XLF",
  SCHW: "XLF",
  V: "XLF",
  MA: "XLF",
  COIN: "XLF",
  HOOD: "XLF",
  SOFI: "XLF",
  SQ: "XLF",
  PYPL: "XLF",
  // Energy
  XOM: "XLE",
  CVX: "XLE",
  COP: "XLE",
  OXY: "XLE",
  // Health
  UNH: "XLV",
  JNJ: "XLV",
  LLY: "XLV",
  ABBV: "XLV",
  MRK: "XLV",
  PFE: "XLV",
  // Industrials
  CAT: "XLI",
  BA: "XLI",
  GE: "XLI",
  HON: "XLI",
  UBER: "XLI",
  // Staples
  PG: "XLP",
  KO: "XLP",
  PEP: "XLP",
  WMT: "XLP",
  COST: "XLP",
  // Materials / utilities / RE
  LIN: "XLB",
  NEE: "XLU",
  AMT: "XLRE",
  // Crypto-adjacent / speculative (map to XLK or XLE proxies)
  MSTR: "XLK",
  MARA: "XLK",
  RIOT: "XLK",
  SHOP: "XLY",
};

export function sectorEtfFor(symbol: string): string {
  return SECTOR_ETF_BY_TICKER[symbol.toUpperCase()] ?? "SPY";
}
