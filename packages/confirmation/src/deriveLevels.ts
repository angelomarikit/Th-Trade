import type { TradeLevels, TradeSide } from "@wulu/domain";
import type { Bar } from "@wulu/market-data";
import { lastCompletedBar } from "@wulu/market-data";
import { findSwingStructure } from "./swingStructure.js";

/**
 * Structural levels from completed 5m swings + recent range.
 * Targets use measured move / range projection — never invented solely to force 2R.
 * Geometry invariants:
 * - LONG: stop < entryLow < entryHigh < target1 < target2 (<= target3)
 * - SHORT: target3 <= target2 < target1 < entryLow < entryHigh < stop
 * If structure cannot support meaningful reward beyond the entry zone, targets still
 * sit beyond the zone (so R:R reflects reality) and RISK_REWARD may WAIT/FAIL.
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
  /** Tiny buffer past entry zone so T1 cannot sit inside the zone (SPY 0.01:1 bug). */
  const beyondPct = 0.0008;

  if (side === "LONG") {
    const trigger = swing.resistance ?? completed.at(-2)?.high ?? lastPrice * 1.002;
    const entryLow = trigger;
    const entryHigh = trigger * 1.003;
    const entryMid = (entryLow + entryHigh) / 2;

    let structuralStop =
      swing.support != null
        ? Math.min(swing.support, last?.low ?? swing.support) * 0.999
        : (last ? Math.min(last.low, completed.at(-2)?.low ?? last.low) : lastPrice) * 0.998;
    // Stop must stay strictly below the entry zone.
    if (!(structuralStop < entryLow)) {
      structuralStop = entryLow * 0.997;
    }

    // Measured-move style projection from the breakout/range — then lift above entry.
    let target1 = rangeHigh + range * 0.35;
    let target2 = rangeHigh + range * 0.7;
    let target3 = rangeHigh + range;
    const minT1 = entryHigh * (1 + beyondPct);
    if (target1 < minT1) {
      // Range projection landed inside/at entry (common when price already above range).
      target1 = entryMid + Math.max(range * 0.5, (entryMid - structuralStop) * 0.5);
      target2 = entryMid + Math.max(range * 1.0, (entryMid - structuralStop) * 1.0);
      target3 = entryMid + Math.max(range * 1.5, (entryMid - structuralStop) * 1.5);
    }
    target1 = Math.max(target1, minT1);
    target2 = Math.max(target2, target1 + Math.max(range * 0.2, entryMid * beyondPct));
    target3 = Math.max(target3, target2 + Math.max(range * 0.2, entryMid * beyondPct));

    return {
      side,
      trigger,
      entryZoneLow: entryLow,
      entryZoneHigh: entryHigh,
      stop: structuralStop,
      target1,
      target2,
      target3,
      invalidation: structuralStop,
    };
  }

  const trigger = swing.support ?? completed.at(-2)?.low ?? lastPrice * 0.998;
  const entryHigh = trigger;
  const entryLow = trigger * 0.997;
  const entryMid = (entryLow + entryHigh) / 2;

  let structuralStop =
    swing.resistance != null
      ? Math.max(swing.resistance, last?.high ?? swing.resistance) * 1.001
      : (last ? Math.max(last.high, completed.at(-2)?.high ?? last.high) : lastPrice) * 1.002;
  if (!(structuralStop > entryHigh)) {
    structuralStop = entryHigh * 1.003;
  }

  let target1 = rangeLow - range * 0.35;
  let target2 = rangeLow - range * 0.7;
  let target3 = rangeLow - range;
  const maxT1 = entryLow * (1 - beyondPct);
  if (target1 > maxT1) {
    target1 = entryMid - Math.max(range * 0.5, (structuralStop - entryMid) * 0.5);
    target2 = entryMid - Math.max(range * 1.0, (structuralStop - entryMid) * 1.0);
    target3 = entryMid - Math.max(range * 1.5, (structuralStop - entryMid) * 1.5);
  }
  target1 = Math.min(target1, maxT1);
  target2 = Math.min(target2, target1 - Math.max(range * 0.2, entryMid * beyondPct));
  target3 = Math.min(target3, target2 - Math.max(range * 0.2, entryMid * beyondPct));

  return {
    side,
    trigger,
    entryZoneLow: entryLow,
    entryZoneHigh: entryHigh,
    stop: structuralStop,
    target1,
    target2,
    target3,
    invalidation: structuralStop,
  };
}
