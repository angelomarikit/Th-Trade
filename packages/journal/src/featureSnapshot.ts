import type { LiveSetupCard } from "@wulu/confirmation";
import {
  FEATURE_SCHEMA_VERSION,
  STRATEGY_DEFINITIONS_VERSION,
} from "./versions.js";

/**
 * Decision-time features only.
 * MUST NOT include future prices, final R, MFE/MAE, or post-entry labels.
 */
export interface FeatureSnapshotV1 {
  schemaVersion: typeof FEATURE_SCHEMA_VERSION;
  strategyDefinitionsVersion: typeof STRATEGY_DEFINITIONS_VERSION;
  decisionAt: string;
  symbol: string;
  side: string;
  state: string;
  lastPrice: number;
  alertAt: number;
  entryMid: number;
  stop: number;
  target1: number;
  target2: number;
  rewardToRisk: number;
  setupScoreTotal: number;
  conditionsPassed: number;
  conditionsTotal: number;
  dataFresh: boolean;
  matrix: Record<string, string>;
  regimePrimary: string | null;
  regimeBias: string | null;
  hasCatalyst: boolean;
  catalystLabel: string | null;
  newsAgeMinutes: number | null;
  priceReaction: string | null;
  matchedStrategyIds: string[];
  historicalEdgeExpectancyR: number | null;
  historicalEdgeSampleSize: number | null;
  historicalEdgeWinRatePct: number | null;
}

export function buildFeatureSnapshotV1(card: LiveSetupCard): FeatureSnapshotV1 {
  const matrix: Record<string, string> = {};
  for (const row of card.matrix.rows) {
    matrix[row.id] = row.status;
  }

  return {
    schemaVersion: FEATURE_SCHEMA_VERSION,
    strategyDefinitionsVersion: STRATEGY_DEFINITIONS_VERSION,
    decisionAt: card.evaluatedAt,
    symbol: card.symbol,
    side: card.side,
    state: card.state,
    lastPrice: card.lastPrice,
    alertAt: card.alertAt,
    entryMid: (card.entryZone.low + card.entryZone.high) / 2,
    stop: card.stop,
    target1: card.target1,
    target2: card.target2,
    rewardToRisk: card.rewardToRisk,
    setupScoreTotal: card.setupScore.total,
    conditionsPassed: card.conditionsPassed,
    conditionsTotal: card.conditionsTotal,
    dataFresh: card.dataFresh,
    matrix,
    regimePrimary: card.regime?.primary ?? null,
    regimeBias: card.regime?.bias ?? null,
    hasCatalyst: card.whyMoving.hasVerifiedCatalyst,
    catalystLabel: card.whyMoving.catalystLabel,
    newsAgeMinutes: card.whyMoving.newsAgeMinutes,
    priceReaction: card.whyMoving.priceReaction,
    matchedStrategyIds: card.matchedStrategies.map((m) => m.strategyId),
    historicalEdgeExpectancyR: card.historicalEdge?.expectancyR ?? null,
    historicalEdgeSampleSize: card.historicalEdge?.sampleSize ?? null,
    historicalEdgeWinRatePct: card.historicalEdge?.winRatePct ?? null,
  };
}

/** Guard: features.decisionAt must be <= journal decision time. */
export function assertNoFeatureLeakage(
  features: FeatureSnapshotV1,
  decisionAt: string,
): void {
  if (features.decisionAt > decisionAt) {
    throw new Error(
      `Feature leakage: features.decisionAt ${features.decisionAt} > decisionAt ${decisionAt}`,
    );
  }
  if ("rMultiple" in (features as object) || "mfeR" in (features as object)) {
    throw new Error("Feature leakage: outcome fields present in feature snapshot");
  }
}
