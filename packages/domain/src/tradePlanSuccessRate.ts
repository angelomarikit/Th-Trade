/** Minimum similar setups before showing a win-rate percentage in WULU Plan. */
export const MIN_HISTORICAL_WIN_RATE_SAMPLE = 5;

export interface TradePlanSuccessRateFields {
  winRatePct: number | null;
  sampleSize: number;
  strategyName: string | null;
  expectancyR: number | null;
  qualityScore10: number | null;
  qualityDisclaimer: string;
  headline: string;
  /** When false, UI should not emphasize win % (misleading at low n). */
  showWinRatePct: boolean;
}

export function buildTradePlanSuccessRate(input: {
  sampleSize: number;
  winRatePct: number | null | undefined;
  expectancyR?: number | null;
  edgeStrategyName?: string | null;
  activeStrategyName?: string | null;
  qualityScore10?: number | null;
  qualityDisclaimer?: string | null;
}): TradePlanSuccessRateFields {
  const sample = Math.max(0, input.sampleSize ?? 0);
  const rawWin =
    sample > 0 && input.winRatePct != null && Number.isFinite(input.winRatePct)
      ? input.winRatePct
      : null;
  const showWinRatePct = sample >= MIN_HISTORICAL_WIN_RATE_SAMPLE && rawWin != null;
  const winRatePct = showWinRatePct ? rawWin : null;

  const strategyName = input.activeStrategyName ?? input.edgeStrategyName ?? null;

  let headline: string;
  if (showWinRatePct && rawWin != null) {
    headline = `Historical win rate ${rawWin.toFixed(0)}% (${sample} similar setups)`;
  } else if (sample > 0 && sample < MIN_HISTORICAL_WIN_RATE_SAMPLE) {
    headline = `Insufficient historical sample (n=${sample}) — win rate not shown until n≥${MIN_HISTORICAL_WIN_RATE_SAMPLE}`;
  } else {
    headline = "No matched historical sample for this pattern yet";
  }

  return {
    winRatePct,
    sampleSize: sample,
    strategyName,
    expectancyR: input.expectancyR ?? null,
    qualityScore10: input.qualityScore10 ?? null,
    qualityDisclaimer:
      input.qualityDisclaimer ??
      "Quality score is setup strength (1–10), not win probability. Confirmations still decide ENTER.",
    headline,
    showWinRatePct,
  };
}
