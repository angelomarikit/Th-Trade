import { spreadPct } from "./indicators.js";
import type { MarketSnapshot } from "./types.js";

/** Spreads above this are never used for live entry permission. */
export const QUOTE_SANITY_SPREAD_PCT = 2;

export type PriceSource = "quote_mid" | "rth_bar_close" | "trade" | "unknown";

export function resolvePriceSource(snapshot: MarketSnapshot): PriceSource {
  if (snapshot.priceSource) return snapshot.priceSource;
  if (snapshot.quote && snapshot.quote.bid > 0 && snapshot.quote.ask > 0) {
    return isQuoteUsableForEntry(snapshot) ? "quote_mid" : "rth_bar_close";
  }
  return "unknown";
}

/** True when bid/ask are present, sane, and tight enough for entry permission. */
export function isQuoteUsableForEntry(
  snapshot: MarketSnapshot,
  maxSpreadPct = 0.35,
): boolean {
  const q = snapshot.quote;
  if (!q || q.bid <= 0 || q.ask <= 0 || q.ask < q.bid) return false;
  const spread = spreadPct(q.bid, q.ask);
  if (spread == null) return false;
  if (spread > QUOTE_SANITY_SPREAD_PCT) return false;
  if (spread > maxSpreadPct) return false;
  return true;
}

export function referencePriceExplanation(source: PriceSource): string {
  switch (source) {
    case "quote_mid":
      return "Live IEX quote mid — used for verified setup evaluation when data is fresh.";
    case "rth_bar_close":
      return "Historical reference: last regular-session bar close. Not a live executable entry price — ENTER blocked until quote is verified.";
    case "trade":
      return "Last trade print — reference only until bid/ask pass liquidity checks.";
    default:
      return "Reference price only — not verified for entry.";
  }
}
