import type { MockPortfolio } from "./mockTrading";
import { DEFAULT_MOCK_SHARES } from "./mockTrading";
import { fmtPrice } from "./format";

export function hasOpenMockPosition(
  portfolio: MockPortfolio,
  symbol: string,
  side: "LONG" | "SHORT",
): boolean {
  const sym = symbol.trim().toUpperCase();
  return portfolio.positions.some((p) => p.symbol === sym && p.side === side);
}

/** Paper-only headline — never implies live ENTER permission. */
export function mockPracticeHeadline(side: "LONG" | "SHORT"): string {
  return side === "LONG" ? "BUY NOW" : "SELL NOW";
}

export function mockPracticeHeroClass(side: "LONG" | "SHORT"): "buy" | "sell" {
  return side === "LONG" ? "buy" : "sell";
}

export function buildMockBuyNowLines(input: {
  symbol: string;
  side: "LONG" | "SHORT";
  entryPrice: number;
  stop: number;
  t1: number;
  shares?: number;
}): string[] {
  const sh = input.shares ?? DEFAULT_MOCK_SHARES;
  const notional = sh * input.entryPrice;
  const verb = input.side === "LONG" ? "Buy" : "Short";
  return [
    `${verb} ${sh} shares ${input.symbol.toUpperCase()} @ ~${fmtPrice(input.entryPrice)} (paper · ~$${notional.toFixed(0)} notional).`,
    `Stop ${fmtPrice(input.stop)} · first target ${fmtPrice(input.t1)}.`,
    "Mock trading only — no broker order. Live ENTER rules still apply outside paper mode.",
  ];
}
