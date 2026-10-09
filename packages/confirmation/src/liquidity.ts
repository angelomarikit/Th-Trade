import { spreadPct } from "@wulu/market-data";
import type { Quote } from "@wulu/market-data";

export interface LiquidityResult {
  pass: boolean;
  fail: boolean;
  spreadPct: number | null;
  reason: string;
}

export function evaluateLiquidity(
  quote: Quote | null,
  maxSpreadPct = 0.35,
): LiquidityResult {
  if (!quote) {
    return {
      pass: false,
      fail: true,
      spreadPct: null,
      reason: "No valid bid/ask quote — liquidity FAIL (common outside RTH)",
    };
  }

  const spread = spreadPct(quote.bid, quote.ask);
  if (spread == null) {
    return {
      pass: false,
      fail: true,
      spreadPct: null,
      reason: "Invalid quote spread — liquidity FAIL",
    };
  }

  if (spread > maxSpreadPct) {
    return {
      pass: false,
      fail: false,
      spreadPct: spread,
      reason: `Waiting for spread/liquidity improvement (spread ${spread.toFixed(2)}% > ${maxSpreadPct}%)`,
    };
  }

  return {
    pass: true,
    fail: false,
    spreadPct: spread,
    reason: `Liquidity PASS: spread ${spread.toFixed(2)}%`,
  };
}
