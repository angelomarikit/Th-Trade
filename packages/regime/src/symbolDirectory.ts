/**
 * Curated ticker → display name for typeahead search (Phase 7).
 * Not a full exchange directory — covers liquid discovery universe.
 */

import { defaultDiscoveryUniverse } from "./liquidUniverse.js";

const NAME_BY_TICKER: Record<string, string> = {
  SPY: "SPDR S&P 500 ETF",
  QQQ: "Invesco QQQ Trust",
  IWM: "iShares Russell 2000 ETF",
  DIA: "SPDR Dow Jones Industrial Average ETF",
  SMH: "VanEck Semiconductor ETF",
  XLK: "Technology Select Sector SPDR",
  XLF: "Financial Select Sector SPDR",
  XLE: "Energy Select Sector SPDR",
  XLV: "Health Care Select Sector SPDR",
  XLY: "Consumer Discretionary Select Sector SPDR",
  XLI: "Industrial Select Sector SPDR",
  XLP: "Consumer Staples Select Sector SPDR",
  XLU: "Utilities Select Sector SPDR",
  XLB: "Materials Select Sector SPDR",
  XLC: "Communication Services Select Sector SPDR",
  XLRE: "Real Estate Select Sector SPDR",
  XBI: "SPDR S&P Biotech ETF",
  ARKK: "ARK Innovation ETF",
  AAPL: "Apple Inc.",
  MSFT: "Microsoft Corporation",
  NVDA: "NVIDIA Corporation",
  AMD: "Advanced Micro Devices",
  AVGO: "Broadcom Inc.",
  TSM: "Taiwan Semiconductor",
  INTC: "Intel Corporation",
  MU: "Micron Technology",
  QCOM: "QUALCOMM Incorporated",
  AMAT: "Applied Materials",
  LRCX: "Lam Research",
  KLAC: "KLA Corporation",
  ASML: "ASML Holding",
  ARM: "Arm Holdings",
  PLTR: "Palantir Technologies",
  CRM: "Salesforce Inc.",
  ORCL: "Oracle Corporation",
  ADBE: "Adobe Inc.",
  NOW: "ServiceNow Inc.",
  SNOW: "Snowflake Inc.",
  PANW: "Palo Alto Networks",
  CRWD: "CrowdStrike Holdings",
  AMZN: "Amazon.com Inc.",
  META: "Meta Platforms Inc.",
  GOOGL: "Alphabet Inc. Class A",
  GOOG: "Alphabet Inc. Class C",
  TSLA: "Tesla Inc.",
  NFLX: "Netflix Inc.",
  DIS: "The Walt Disney Company",
  UBER: "Uber Technologies",
  SHOP: "Shopify Inc.",
  SQ: "Block Inc.",
  PYPL: "PayPal Holdings",
  JPM: "JPMorgan Chase",
  BAC: "Bank of America",
  GS: "Goldman Sachs",
  MS: "Morgan Stanley",
  C: "Citigroup Inc.",
  WFC: "Wells Fargo",
  BLK: "BlackRock Inc.",
  SCHW: "Charles Schwab",
  V: "Visa Inc.",
  MA: "Mastercard Inc.",
  XOM: "Exxon Mobil",
  CVX: "Chevron Corporation",
  COP: "ConocoPhillips",
  OXY: "Occidental Petroleum",
  CAT: "Caterpillar Inc.",
  BA: "Boeing Company",
  GE: "GE Aerospace",
  HON: "Honeywell International",
  UNH: "UnitedHealth Group",
  JNJ: "Johnson & Johnson",
  LLY: "Eli Lilly and Company",
  ABBV: "AbbVie Inc.",
  MRK: "Merck & Co.",
  PFE: "Pfizer Inc.",
  WMT: "Walmart Inc.",
  COST: "Costco Wholesale",
  HD: "Home Depot",
  NKE: "Nike Inc.",
  SBUX: "Starbucks Corporation",
  MCD: "McDonald's Corporation",
  PG: "Procter & Gamble",
  KO: "Coca-Cola Company",
  PEP: "PepsiCo Inc.",
  COIN: "Coinbase Global",
  MSTR: "MicroStrategy Inc.",
  RIVN: "Rivian Automotive",
  SOFI: "SoFi Technologies",
  HOOD: "Robinhood Markets",
  SMCI: "Super Micro Computer",
  MARA: "Marathon Digital",
  RIOT: "Riot Platforms",
};

export interface SymbolSearchHit {
  symbol: string;
  name: string;
  match: "ticker" | "name";
}

/** Search curated universe by ticker prefix or company name substring. */
export function searchSymbols(query: string, limit = 12): SymbolSearchHit[] {
  const q = query.trim().toUpperCase();
  if (!q || q.length < 1) return [];
  const universe = defaultDiscoveryUniverse();
  const tickerHits: SymbolSearchHit[] = [];
  const nameHits: SymbolSearchHit[] = [];

  for (const symbol of universe) {
    const name = NAME_BY_TICKER[symbol] ?? symbol;
    if (symbol.startsWith(q)) {
      tickerHits.push({ symbol, name, match: "ticker" });
    } else if (name.toUpperCase().includes(q)) {
      nameHits.push({ symbol, name, match: "name" });
    }
  }

  tickerHits.sort((a, b) => a.symbol.localeCompare(b.symbol));
  nameHits.sort((a, b) => a.symbol.localeCompare(b.symbol));
  return [...tickerHits, ...nameHits].slice(0, Math.min(Math.max(limit, 1), 25));
}

export function displayNameForSymbol(symbol: string): string {
  const s = symbol.toUpperCase();
  return NAME_BY_TICKER[s] ?? s;
}
