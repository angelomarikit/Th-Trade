import type { TradeSide } from "@wulu/domain";
import type { MarketSnapshot } from "@wulu/market-data";
import { analyzeBreakout, type BreakoutMode } from "./breakoutAnalysis.js";
import { deriveLevels } from "./deriveLevels.js";

const MODE_SCORE: Record<BreakoutMode, number> = {
  CONFIRMED_CLOSE: 4,
  BREAKING: 3,
  APPROACHING: 2,
  NONE: 0,
  FAILED_HOLD: -2,
};

/**
 * One mock-ENTER side per snapshot — matches production (long OR short, not both).
 */
export function pickLabMockEnterSide(snapshot: MarketSnapshot): TradeSide {
  const price = snapshot.lastPrice;
  const longLevels = deriveLevels(snapshot.bars5m, "LONG", price);
  const shortLevels = deriveLevels(snapshot.bars5m, "SHORT", price);
  const longBr = analyzeBreakout({
    side: "LONG",
    bars5m: snapshot.bars5m,
    trigger: longLevels.trigger,
  });
  const shortBr = analyzeBreakout({
    side: "SHORT",
    bars5m: snapshot.bars5m,
    trigger: shortLevels.trigger,
  });

  let longScore = MODE_SCORE[longBr.mode];
  let shortScore = MODE_SCORE[shortBr.mode];
  if (longBr.structureTrend === "HH_HL") longScore += 0.5;
  if (shortBr.structureTrend === "LH_LL") shortScore += 0.5;
  if (price >= longLevels.trigger) longScore += 0.25;
  if (price <= shortLevels.trigger) shortScore += 0.25;

  if (longScore > shortScore) return "LONG";
  if (shortScore > longScore) return "SHORT";

  const distLong = Math.abs(price - longLevels.trigger);
  const distShort = Math.abs(price - shortLevels.trigger);
  return distLong <= distShort ? "LONG" : "SHORT";
}
