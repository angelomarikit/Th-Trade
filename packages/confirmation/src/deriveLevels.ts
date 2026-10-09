import type { TradeLevels, TradeSide } from "@wulu/domain";
import type { Bar } from "@wulu/market-data";
import { lastCompletedBar } from "@wulu/market-data";

/**
 * Derive provisional levels from recent 5m structure.
 * Phase D strategies will replace this with strategy-specific geometry.
 */
export function deriveLevels(
  bars5m: Bar[],
  side: TradeSide,
  lastPrice: number,
): TradeLevels {
  const completed = bars5m.filter((b) => b.completed);
  const last = lastCompletedBar(bars5m) ?? completed.at(-1);
  const prior = completed.at(-2);

  if (side === "LONG") {
    const trigger = prior ? prior.high : lastPrice * 1.002;
    const stop = last ? Math.min(last.low, prior?.low ?? last.low) * 0.998 : lastPrice * 0.99;
    const entryLow = trigger;
    const entryHigh = trigger * 1.004;
    const risk = Math.abs(((entryLow + entryHigh) / 2) - stop);
    return {
      side,
      trigger,
      entryZoneLow: entryLow,
      entryZoneHigh: entryHigh,
      stop,
      target1: (entryLow + entryHigh) / 2 + risk * 1.8,
      target2: (entryLow + entryHigh) / 2 + risk * 3,
    };
  }

  const trigger = prior ? prior.low : lastPrice * 0.998;
  const stop = last ? Math.max(last.high, prior?.high ?? last.high) * 1.002 : lastPrice * 1.01;
  const entryHigh = trigger;
  const entryLow = trigger * 0.996;
  const risk = Math.abs(stop - (entryLow + entryHigh) / 2);
  return {
    side,
    trigger,
    entryZoneLow: entryLow,
    entryZoneHigh: entryHigh,
    stop,
    target1: (entryLow + entryHigh) / 2 - risk * 1.8,
    target2: (entryLow + entryHigh) / 2 - risk * 3,
  };
}
