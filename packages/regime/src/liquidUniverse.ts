/**
 * Curated liquid US equity / ETF universe for Phase 5 discovery.
 * Not a full exchange screener — chosen for IEX liquidity + sector coverage.
 * Override with comma-separated DISCOVERY_UNIVERSE env.
 */

import { SECTOR_ETF_BY_TICKER } from "./sectorMap.js";

/** Major sector / index ETFs always included for regime context. */
export const DISCOVERY_ETFS = [
  "SPY",
  "QQQ",
  "IWM",
  "DIA",
  "SMH",
  "XLK",
  "XLF",
  "XLE",
  "XLV",
  "XLY",
  "XLI",
  "XLP",
  "XLU",
  "XLB",
  "XLC",
  "XLRE",
  "XBI",
  "ARKK",
] as const;

/** Liquid single names — mega/large-cap + active traders' names. */
export const DISCOVERY_EQUITIES = [
  // Tech / semis
  "AAPL",
  "MSFT",
  "NVDA",
  "AMD",
  "AVGO",
  "TSM",
  "INTC",
  "MU",
  "QCOM",
  "AMAT",
  "LRCX",
  "KLAC",
  "ASML",
  "ARM",
  "PLTR",
  "CRM",
  "ORCL",
  "ADBE",
  "NOW",
  "SNOW",
  "PANW",
  "CRWD",
  // Mega consumer / internet
  "AMZN",
  "META",
  "GOOGL",
  "GOOG",
  "TSLA",
  "NFLX",
  "DIS",
  "UBER",
  "SHOP",
  "SQ",
  "PYPL",
  // Financials
  "JPM",
  "BAC",
  "GS",
  "MS",
  "C",
  "WFC",
  "BLK",
  "SCHW",
  "V",
  "MA",
  // Energy / industrials / health
  "XOM",
  "CVX",
  "COP",
  "OXY",
  "CAT",
  "BA",
  "GE",
  "HON",
  "UNH",
  "JNJ",
  "LLY",
  "ABBV",
  "MRK",
  "PFE",
  // Consumer / retail
  "WMT",
  "COST",
  "HD",
  "NKE",
  "SBUX",
  "MCD",
  "PG",
  "KO",
  "PEP",
  // High-beta / popular
  "COIN",
  "MSTR",
  "RIVN",
  "SOFI",
  "HOOD",
  "SMCI",
  "MARA",
  "RIOT",
] as const;

export function defaultDiscoveryUniverse(): string[] {
  const set = new Set<string>();
  for (const s of DISCOVERY_ETFS) set.add(s);
  for (const s of DISCOVERY_EQUITIES) set.add(s);
  // Ensure every mapped sector ticker is discoverable
  for (const s of Object.keys(SECTOR_ETF_BY_TICKER)) set.add(s.toUpperCase());
  return [...set].sort();
}

/** Resolve universe from env DISCOVERY_UNIVERSE or curated default. */
export function resolveDiscoveryUniverse(env: NodeJS.ProcessEnv = process.env): string[] {
  const raw = (env.DISCOVERY_UNIVERSE ?? "").trim();
  if (!raw) return defaultDiscoveryUniverse();
  const parsed = raw
    .split(/[,|\s]+/)
    .map((s) => s.trim().toUpperCase())
    .filter((s) => /^[A-Z][A-Z0-9.-]{0,9}$/.test(s));
  return parsed.length ? [...new Set(parsed)] : defaultDiscoveryUniverse();
}
