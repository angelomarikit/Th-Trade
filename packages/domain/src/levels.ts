export type TradeSide = "LONG" | "SHORT";

export interface TradeLevels {
  side: TradeSide;
  trigger: number;
  entryZoneLow: number;
  entryZoneHigh: number;
  stop: number;
  target1: number;
  target2: number;
  /** Optional measured-move / next structure target */
  target3?: number;
  /** Structural invalidation level (may equal or sit beyond stop) */
  invalidation?: number;
}

export interface RiskRewardMetrics {
  rewardToRisk: number;
  stopDistance: number;
  target1Distance: number;
  meetsMinimum: boolean;
  minimumRequired: number;
}

/** Default minimum R:R to Target 1 for ENTRY ACTIVE (Phase 3). */
export const MIN_REWARD_TO_RISK = 2;

export function computeRiskReward(
  levels: TradeLevels,
  minimumRequired: number = MIN_REWARD_TO_RISK,
): RiskRewardMetrics {
  const mid = (levels.entryZoneLow + levels.entryZoneHigh) / 2;
  return computeRiskRewardAtEntry(levels, mid, minimumRequired);
}

/** R:R from a specific entry price (use conservative fill for ENTRY gates). */
export function computeRiskRewardAtEntry(
  levels: TradeLevels,
  entryPrice: number,
  minimumRequired: number = MIN_REWARD_TO_RISK,
): RiskRewardMetrics {
  const stopDistance = Math.abs(entryPrice - levels.stop);
  const target1Distance = Math.abs(levels.target1 - entryPrice);
  const rewardToRisk = stopDistance > 0 ? target1Distance / stopDistance : 0;

  return {
    rewardToRisk,
    stopDistance,
    target1Distance,
    meetsMinimum: rewardToRisk >= minimumRequired,
    minimumRequired,
  };
}

/**
 * Worst-case entry for R:R — LONG uses top of zone (pay up), SHORT uses bottom.
 * When price is outside the zone, assume fill at the nearest zone edge toward price.
 */
export function conservativeEntryPriceForRisk(
  levels: TradeLevels,
  lastPrice: number,
): number {
  const low = Math.min(levels.entryZoneLow, levels.entryZoneHigh);
  const high = Math.max(levels.entryZoneLow, levels.entryZoneHigh);
  if (levels.side === "LONG") {
    if (lastPrice >= low && lastPrice <= high) return high;
    if (lastPrice > high) return high;
    return high;
  }
  if (lastPrice >= low && lastPrice <= high) return low;
  if (lastPrice < low) return low;
  return low;
}

/**
 * Entry zone is executable when last price is inside or within a small
 * chase-buffer of the zone. Outside = do not allow ENTRY ACTIVE.
 */
export function isEntryZoneExecutable(
  levels: TradeLevels,
  lastPrice: number,
  chaseBufferPct = 0.0015,
): boolean {
  const low = Math.min(levels.entryZoneLow, levels.entryZoneHigh);
  const high = Math.max(levels.entryZoneLow, levels.entryZoneHigh);
  const buffer = ((low + high) / 2) * chaseBufferPct;
  return lastPrice >= low - buffer && lastPrice <= high + buffer;
}
