import type { TradeLevels, TradeSide } from "@wulu/domain";
import type { Bar } from "@wulu/market-data";
import { lastCompletedBar } from "@wulu/market-data";
import { findSwingStructure } from "./swingStructure.js";

/**
 * Structural levels from completed 5m swings + recent range.
 * Targets use measured move / range projection — never invented solely to force 2R.
 * If geometry cannot support minimum R:R, RISK_REWARD stays WAITING/FAIL (no ENTRY ACTIVE).
 */
export function deriveLevels(
  bars5m: Bar[],
  side: TradeSide,
  lastPrice: number,
): TradeLevels {
  const completed = bars5m.filter((b) => b.completed);
  const last = lastCompletedBar(bars5m) ?? completed.at(-1);
  const swing = findSwingStructure(bars5m);
  const rangeHigh = swing.consolidationHigh ?? last?.high ?? lastPrice;
  const rangeLow = swing.consolidationLow ?? last?.low ?? lastPrice;
  const range = Math.max(1e-6, rangeHigh - rangeLow);

  if (side === "LONG") {
    const trigger = swing.resistance ?? completed.at(-2)?.high ?? lastPrice * 1.002;
    const structuralStop =
      swing.support != null
        ? Math.min(swing.support, last?.low ?? swing.support) * 0.999
        : (last ? Math.min(last.low, completed.at(-2)?.low ?? last.low) : lastPrice) * 0.998;
    const entryLow = trigger;
    const entryHigh = trigger * 1.003;
    return {
      side,
      trigger,
      entryZoneLow: entryLow,
      entryZoneHigh: entryHigh,
      stop: structuralStop,
      target1: rangeHigh + range * 0.35,
      target2: rangeHigh + range * 0.7,
      target3: rangeHigh + range,
      invalidation: structuralStop,
    };
  }

  const trigger = swing.support ?? completed.at(-2)?.low ?? lastPrice * 0.998;
  const structuralStop =
    swing.resistance != null
      ? Math.max(swing.resistance, last?.high ?? swing.resistance) * 1.001
      : (last ? Math.max(last.high, completed.at(-2)?.high ?? last.high) : lastPrice) * 1.002;
  const entryHigh = trigger;
  const entryLow = trigger * 0.997;
  return {
    side,
    trigger,
    entryZoneLow: entryLow,
    entryZoneHigh: entryHigh,
    stop: structuralStop,
    target1: rangeLow - range * 0.35,
    target2: rangeLow - range * 0.7,
    target3: rangeLow - range,
    invalidation: structuralStop,
  };
}
