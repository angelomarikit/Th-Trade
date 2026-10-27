import type { SetupWatchView, StockDecisionOutput } from "./types.js";

export function buildSetupWatch(decision: StockDecisionOutput): SetupWatchView | null {
  if (decision.finalAction !== "WAIT_FOR_TRIGGER") return null;
  const primary = decision.primaryStrategy;
  const wait =
    decision.strategiesEvaluated.find(
      (s) => s.action === "WAIT_FOR_TRIGGER" && s.strategy === primary,
    ) ??
    decision.strategiesEvaluated.find((s) => s.action === "WAIT_FOR_TRIGGER" && s.waitTrigger);
  const strategy = primary ?? wait?.strategy ?? null;
  return {
    symbol: decision.symbol,
    strategy,
    status: decision.finalAction,
    reason: wait?.reason ?? decision.decisionReason,
    nextAction:
      wait?.waitTrigger ??
      decision.nextReevaluationTrigger ??
      "Re-evaluate on next completed bar for this strategy's timeframe",
    invalidation:
      wait?.conditionsMissing.join(", ") ||
      "Structural break of trend, support, or session data loss",
    expiresRule:
      wait?.expiresAt ??
      decision.signalExpiration ??
      (strategy === "EMA_PULLBACK_DAILY"
        ? "Expire after 3 trading sessions without confirmation"
        : "Expire when trigger fires or invalidation hits"),
  };
}
