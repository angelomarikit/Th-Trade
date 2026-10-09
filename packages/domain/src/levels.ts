export type TradeSide = "LONG" | "SHORT";

export interface TradeLevels {
  side: TradeSide;
  trigger: number;
  entryZoneLow: number;
  entryZoneHigh: number;
  stop: number;
  target1: number;
  target2: number;
}

export interface RiskRewardMetrics {
  rewardToRisk: number;
  stopDistance: number;
  target1Distance: number;
  meetsMinimum: boolean;
  minimumRequired: number;
}

/** Default minimum R:R for Phase B (can be strategy-overridden later). */
export const MIN_REWARD_TO_RISK = 1.5;

export function computeRiskReward(
  levels: TradeLevels,
  minimumRequired: number = MIN_REWARD_TO_RISK,
): RiskRewardMetrics {
  const mid =
    (levels.entryZoneLow + levels.entryZoneHigh) / 2;
  const stopDistance = Math.abs(mid - levels.stop);
  const target1Distance = Math.abs(levels.target1 - mid);
  const rewardToRisk =
    stopDistance > 0 ? target1Distance / stopDistance : 0;

  return {
    rewardToRisk,
    stopDistance,
    target1Distance,
    meetsMinimum: rewardToRisk >= minimumRequired,
    minimumRequired,
  };
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
