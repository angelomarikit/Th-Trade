/**
 * Transparent 0–100 setup quality score.
 * NOT win probability. NOT historical win rate.
 */
export interface SetupScoreBreakdown {
  technicalStructure: number;
  volume: number;
  relativeVolume: number;
  marketAlignment: number;
  sectorAlignment: number;
  catalystQuality: number;
  priceReactionToCatalyst: number;
  liquidity: number;
  riskReward: number;
  dataQuality: number;
}

export interface SetupScore {
  total: number;
  breakdown: SetupScoreBreakdown;
  disclaimer: string;
}

export const SETUP_SCORE_DISCLAIMER =
  "SETUP SCORE IS NOT WIN PROBABILITY. It measures setup quality components only.";

const WEIGHTS: Record<keyof SetupScoreBreakdown, number> = {
  technicalStructure: 18,
  volume: 10,
  relativeVolume: 10,
  marketAlignment: 8,
  sectorAlignment: 6,
  catalystQuality: 10,
  priceReactionToCatalyst: 8,
  liquidity: 10,
  riskReward: 12,
  dataQuality: 8,
};

export function computeSetupScore(parts: SetupScoreBreakdown): SetupScore {
  let weighted = 0;
  let weightSum = 0;
  for (const key of Object.keys(WEIGHTS) as (keyof SetupScoreBreakdown)[]) {
    const w = WEIGHTS[key];
    const v = clamp(parts[key], 0, 100);
    weighted += v * w;
    weightSum += w;
  }
  return {
    total: Math.round(weighted / weightSum),
    breakdown: parts,
    disclaimer: SETUP_SCORE_DISCLAIMER,
  };
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
