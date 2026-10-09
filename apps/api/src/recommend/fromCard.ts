import type { LiveSetupCard } from "@wulu/confirmation";
import type { TradeSide } from "@wulu/domain";
import {
  buildFallbackBrief,
  deriveRecommendation,
  narrateRecommendation,
  toTradeAction,
  type DeterministicRecommendation,
  type TradeAction,
} from "./engine.js";

export interface SignalRecommendationPayload {
  action: TradeAction;
  recommendation: DeterministicRecommendation["recommendation"];
  confidence: DeterministicRecommendation["confidence"];
  reasons: string[];
  blockers: string[];
  brief: string;
  briefSource: "rules" | "model";
  automatic: true;
}

export function buildSetupSnapshot(card: LiveSetupCard) {
  return {
    status: card.statusLabel,
    state: card.state,
    dataFresh: card.dataFresh,
    session: card.session?.session ?? null,
    etLabel: card.session?.etLabel ?? null,
    conditionsPassed: card.conditionsPassed,
    conditionsTotal: card.conditionsTotal,
    matrix: card.matrix.rows.map((r) => ({
      id: r.id,
      label: r.label,
      status: r.status,
      reason: r.reason,
    })),
    rewardToRisk: card.rewardToRisk,
    setupScore: card.setupScore.total,
    lastPrice: card.lastPrice,
    waitingFor: card.nearActive.stillWaitingFor,
    alertAt: card.alertAt,
    entryZone: card.entryZone,
    stop: card.stop,
    t1: card.target1,
    t2: card.target2,
    market: card.regime?.bias ?? null,
    marketRegime: card.regime?.primary ?? null,
    whyMoving: card.whyMoving.whyMoving,
    catalyst: card.whyMoving.catalystLabel,
    priceReaction: card.whyMoving.priceReaction,
    matchedStrategies: card.matchedStrategies,
    historicalEdge: card.historicalEdge
      ? {
          strategyName: card.historicalEdge.strategyName,
          sampleSize: card.historicalEdge.sampleSize,
          expectancyR: card.historicalEdge.expectancyR,
          winRatePct: card.historicalEdge.winRatePct,
          collapsedSummary: card.historicalEdge.collapsedSummary,
        }
      : null,
    evaluatedAt: card.evaluatedAt,
  };
}

export function signalFromCard(card: LiveSetupCard, side: TradeSide) {
  const deterministic = deriveRecommendation({
    status: card.statusLabel,
    state: card.state,
    dataFresh: card.dataFresh,
    session: card.session?.session ?? null,
    conditionsPassed: card.conditionsPassed,
    conditionsTotal: card.conditionsTotal,
    rewardToRisk: card.rewardToRisk,
    setupScore: card.setupScore.total,
    waitingFor: card.nearActive.stillWaitingFor,
    edgeSampleSize: card.historicalEdge?.sampleSize ?? null,
    edgeExpectancyR: card.historicalEdge?.expectancyR ?? null,
  });
  const action = toTradeAction(side, deterministic.recommendation);
  return { deterministic, action, snapshot: buildSetupSnapshot(card) };
}

export async function buildAutomaticSignal(input: {
  card: LiveSetupCard;
  side: TradeSide;
  withModelBrief: boolean;
  deep?: boolean;
}): Promise<SignalRecommendationPayload> {
  const { deterministic, action, snapshot } = signalFromCard(input.card, input.side);
  if (!input.withModelBrief) {
    return {
      action,
      recommendation: deterministic.recommendation,
      confidence: deterministic.confidence,
      reasons: deterministic.reasons,
      blockers: deterministic.blockers,
      brief: buildFallbackBrief(input.card.symbol, input.side, action, deterministic),
      briefSource: "rules",
      automatic: true,
    };
  }
  const brief = await narrateRecommendation({
    symbol: input.card.symbol,
    side: input.side,
    action,
    deterministic,
    deep: input.deep === true,
    setupSummary: snapshot,
  });
  return {
    action,
    recommendation: deterministic.recommendation,
    confidence: deterministic.confidence,
    reasons: deterministic.reasons,
    blockers: deterministic.blockers,
    brief,
    briefSource: (process.env.OPENAI_API_KEY ?? "").trim() ? "model" : "rules",
    automatic: true,
  };
}
