import { spreadPct } from "@wulu/market-data";
import type { Quote } from "@wulu/market-data";

export interface LiquidityResult {
  pass: boolean;
  fail: boolean;
  spreadPct: number | null;
  reason: string;
  bid: number | null;
  ask: number | null;
  quoteAt: string | null;
}

/** Spreads above this are treated as unusable NBBO (common after-hours on IEX). */
export const LIQUIDITY_SANITY_SPREAD_PCT = 2;

export function evaluateLiquidity(
  quote: Quote | null,
  maxSpreadPct = 0.35,
  opts?: { maxQuoteAgeMs?: number; now?: Date },
): LiquidityResult {
  const empty = {
    bid: null as number | null,
    ask: null as number | null,
    quoteAt: null as string | null,
  };
  if (!quote) {
    return {
      pass: false,
      fail: true,
      spreadPct: null,
      reason: "No valid bid/ask quote — liquidity FAIL (common outside RTH)",
      ...empty,
    };
  }

  const quoteAt = quote.timestamp?.toISOString?.() ?? null;
  const bid = quote.bid;
  const ask = quote.ask;
  const meta = { bid, ask, quoteAt };

  const maxAge = opts?.maxQuoteAgeMs;
  if (maxAge != null && maxAge > 0 && quote.timestamp) {
    const ageMs = (opts?.now ?? new Date()).getTime() - quote.timestamp.getTime();
    if (ageMs > maxAge) {
      return {
        pass: false,
        fail: true,
        spreadPct: null,
        reason: `Quote too old for liquidity (${Math.round(ageMs / 1000)}s) — bid ${bid.toFixed(2)} ask ${ask.toFixed(2)}`,
        ...meta,
      };
    }
  }

  const spread = spreadPct(quote.bid, quote.ask);
  if (spread == null) {
    return {
      pass: false,
      fail: true,
      spreadPct: null,
      reason: "Invalid quote spread — liquidity FAIL",
      ...meta,
    };
  }

  if (spread > LIQUIDITY_SANITY_SPREAD_PCT) {
    return {
      pass: false,
      fail: true,
      spreadPct: spread,
      reason: `Quote unusable — spread ${spread.toFixed(2)}% (bid ${bid.toFixed(2)}, ask ${ask.toFixed(2)}${quoteAt ? `, ${quoteAt}` : ""}). Often after-hours IEX; not RTH liquidity.`,
      ...meta,
    };
  }

  if (spread > maxSpreadPct) {
    return {
      pass: false,
      fail: false,
      spreadPct: spread,
      reason: `Waiting for spread/liquidity improvement (spread ${spread.toFixed(2)}% > ${maxSpreadPct}%; bid ${bid.toFixed(2)}, ask ${ask.toFixed(2)})`,
      ...meta,
    };
  }

  return {
    pass: true,
    fail: false,
    spreadPct: spread,
    reason: `Liquidity PASS: spread ${spread.toFixed(2)}% (bid ${bid.toFixed(2)}, ask ${ask.toFixed(2)})`,
    ...meta,
  };
}
