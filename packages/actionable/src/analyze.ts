import type { AnalyzeStockInput, FinalAction, StockDecisionOutput } from "./types.js";
import { resolveMarketRegime, spyRegimeSignals } from "./marketRegime.js";
import { evaluateAllStrategies } from "./strategies/evaluate.js";
import { applyRegimeEligibility, pickBestAction, pickPrimaryStrategy } from "./selectPrimary.js";
import { paperPositionSize } from "./positionSizing.js";
import { buildSetupWatch } from "./liveWatch.js";

export function analyzeStock(input: AnalyzeStockInput): StockDecisionOutput {
  const now = input.now ?? new Date();
  const signals = spyRegimeSignals(input.spyDaily);
  const marketRegime = resolveMarketRegime(signals);

  let evaluations = evaluateAllStrategies({
    stockDaily: input.stockDaily,
    bars5m: input.bars5m,
    bars15m: input.bars15m,
    volumeFeedComparable: input.volumeFeedComparable,
    spreadPct: input.spreadPct,
    orbEnabled: input.openingRangeBreakoutEnabled,
  });
  evaluations = applyRegimeEligibility(evaluations, marketRegime);

  const { primary } = pickPrimaryStrategy(evaluations);
  const best =
    evaluations.find((e) => e.strategy === primary) ?? pickBestAction(evaluations);

  let finalAction: FinalAction = best?.action ?? "SKIP";
  let decisionReason = best?.reason ?? "No strategy qualified";
  const confirmationsPassed = best?.confirmationsPassed ?? [];
  const conditionsMissing = best?.conditionsMissing ?? [];

  const acct = input.paperAccount;
  if (
    finalAction === "BUY_CANDIDATE" &&
    acct &&
    (acct.hasOpenPositionInSymbol || acct.hasPendingOrderInSymbol)
  ) {
    finalAction = "RISK_BLOCKED";
    decisionReason = "Duplicate position or open order on symbol";
  }

  let suggestedPaperSize: import("./types.js").PaperPositionSize = {
    calculated: false,
    shares: null,
    riskAmount: null,
    message: "Paper account not supplied — size not calculated",
  };

  if (
    finalAction === "BUY_CANDIDATE" &&
    best?.proposedEntry != null &&
    best.stopLoss != null &&
    acct
  ) {
    suggestedPaperSize = paperPositionSize({
      equity: acct.equity,
      buyingPower: acct.buyingPower,
      entry: best.proposedEntry,
      stop: best.stopLoss,
      openPositionCount: acct.openPositionCount,
      openPortfolioRiskPct: acct.openPortfolioRiskPct,
      rewardToRisk: best.rewardToRisk,
    });
    if (!suggestedPaperSize.calculated && suggestedPaperSize.message?.startsWith("RISK_BLOCKED")) {
      finalAction = "RISK_BLOCKED";
      decisionReason = suggestedPaperSize.message;
    }
  }

  const executionEligible =
    finalAction === "BUY_CANDIDATE" &&
    best?.proposedEntry != null &&
    best.stopLoss != null &&
    best.takeProfit != null &&
    (best.rewardToRisk ?? 0) >= 2 &&
    suggestedPaperSize.calculated === true;

  const output: StockDecisionOutput = {
    symbol: input.symbol.toUpperCase(),
    marketRegime,
    currentPrice: input.lastPrice,
    evaluatedAt: now.toISOString(),
    dataFeed: input.dataFeed,
    volumeFeedComparable: input.volumeFeedComparable,
    strategiesEvaluated: evaluations,
    primaryStrategy: primary,
    finalAction,
    entryCondition: best?.entryCondition ?? null,
    proposedEntry: best?.proposedEntry ?? null,
    entryRange: best?.entryRange ?? null,
    stopLoss: best?.stopLoss ?? null,
    takeProfit: best?.takeProfit ?? null,
    estimatedRewardToRisk: best?.rewardToRisk ?? null,
    riskAmount: suggestedPaperSize.riskAmount,
    suggestedPaperSize,
    confirmationsPassed,
    conditionsMissing,
    decisionReason,
    nextReevaluationTrigger: best?.waitTrigger ?? "Next completed bar or regime change",
    signalExpiration: best?.expiresAt ?? null,
    executionEligible,
    setupWatch: null,
    advisoryOnly: true,
  };
  output.setupWatch = buildSetupWatch(output);
  return output;
}
