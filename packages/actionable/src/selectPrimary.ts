import type { MarketRegimeLabel, StrategyEvaluation, StrategyKey } from "./types.js";
import { strategyAllowedInRegime } from "./marketRegime.js";

export function applyRegimeEligibility(
  evaluations: StrategyEvaluation[],
  regime: MarketRegimeLabel,
): StrategyEvaluation[] {
  return evaluations.map((e) => {
    const allowed = strategyAllowedInRegime(e.strategy, regime);
    if (!allowed && e.action === "BUY_CANDIDATE") {
      return {
        ...e,
        action: "SKIP" as const,
        eligibleInRegime: false,
        reason: `${e.reason} — blocked in ${regime} regime`,
        score: 0,
      };
    }
    return { ...e, eligibleInRegime: allowed };
  });
}

export function pickPrimaryStrategy(
  evaluations: StrategyEvaluation[],
): { primary: StrategyKey | null; ranked: StrategyEvaluation[] } {
  const candidates = evaluations
    .filter((e) => e.action === "BUY_CANDIDATE" && e.eligibleInRegime)
    .sort((a, b) => b.score - a.score);
  return { primary: candidates[0]?.strategy ?? null, ranked: candidates };
}

export function pickBestAction(evaluations: StrategyEvaluation[]): StrategyEvaluation | null {
  const order = ["BUY_CANDIDATE", "WAIT_FOR_TRIGGER", "RISK_BLOCKED", "SKIP", "DATA_UNAVAILABLE"] as const;
  for (const action of order) {
    const found = evaluations
      .filter((e) => e.action === action && e.eligibleInRegime !== false)
      .sort((a, b) => b.score - a.score)[0];
    if (found) return found;
  }
  return evaluations[0] ?? null;
}
