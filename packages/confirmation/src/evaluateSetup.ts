import type { SetupState, TradeSide } from "@wulu/domain";
import {
  assessFreshness,
  classifyUsEquitySession,
  confirmationProfileForSession,
  type MarketSnapshot,
} from "@wulu/market-data";
import type { WhyMovingBlock } from "@wulu/news";
import { buildSetupConditionMatrix, type AlignmentInput } from "./buildMatrix.js";
import { deriveLevels } from "./deriveLevels.js";
import { buildNearActiveView } from "./nearActive.js";
import { setupScoreFromMatrix } from "./scoreFromMatrix.js";
import { assertEntryNotFromNewsAlone, decideSetupState } from "./stateMachine.js";
import type {
  HistoricalEdgeCardInfo,
  LiveSetupCard,
  MatchedStrategyInfo,
  OptionsCardInfo,
  RegimeCardInfo,
  RelativeMomentumCardInfo,
} from "./liveCard.js";


export interface EvaluateSetupInput {
  symbol: string;
  side: TradeSide;
  snapshot: MarketSnapshot;
  whyMoving: WhyMovingBlock;
  previousState?: SetupState;
  now?: Date;
  marketRegime?: AlignmentInput;
  sectorAlignment?: AlignmentInput;
  regimeInfo?: RegimeCardInfo;
  historicalEdge?: HistoricalEdgeCardInfo | null;
  matchedStrategies?: MatchedStrategyInfo[];
  options?: OptionsCardInfo | null;
  catalystQualityScore?: number;
  priceReactionScore?: number;
  marketAlignmentScore?: number;
  sectorAlignmentScore?: number;
  relativeMomentum?: RelativeMomentumCardInfo | null;
}



export function evaluateSetup(input: EvaluateSetupInput): LiveSetupCard {
  const now = input.now ?? new Date();
  const session = classifyUsEquitySession(now);
  const profile = confirmationProfileForSession(session);
  const freshness = assessFreshness(input.snapshot, now, profile.maxDataAgeMs, session);
  const levels = deriveLevels(input.snapshot.bars5m, input.side, input.snapshot.lastPrice);

  const built = buildSetupConditionMatrix({
    side: input.side,
    snapshot: input.snapshot,
    freshness,
    levels,
    whyMoving: input.whyMoving,
    marketRegime: input.marketRegime,
    sectorAlignment: input.sectorAlignment,
    profile,
  });



  const prev = input.previousState;
  const wasNearOrActive =
    prev === "NEAR_ACTIVE" ||
    prev === "ENTRY_ACTIVE_LONG" ||
    prev === "ENTRY_ACTIVE_SHORT";

  const leftZone = wasNearOrActive && !built.zoneExecutable;
  const structureRow = built.matrix.rows.find((r) => r.id === "STRUCTURE");
  // Wire SM input previously unused — clear structure FAIL after near/entry → INVALIDATED
  const structureInvalidated = wasNearOrActive && structureRow?.status === "FAIL";

  const state = decideSetupState({
    side: input.side,
    matrix: built.matrix,
    zoneExecutable: built.zoneExecutable,
    previousState: input.previousState,
    leftExecutableZone: leftZone,
    structureInvalidated,
  });

  assertEntryNotFromNewsAlone(state, built.matrix);

  const setupScore = setupScoreFromMatrix(built.matrix, {
    catalystQuality: input.catalystQualityScore,
    priceReaction: input.priceReactionScore,
    marketAlignment: input.marketAlignmentScore,
    sectorAlignment: input.sectorAlignmentScore,
  });

  const evaluatedAt = now.toISOString();
  const near = buildNearActiveView({
    state,
    matrix: built.matrix,
    levels,
    lastPrice: input.snapshot.lastPrice,
    dataTimestamp: evaluatedAt,
    setupQualityScore: setupScore.total,
  });

  return {
    symbol: input.symbol.toUpperCase(),
    side: input.side,
    state,
    statusLabel: near.statusLabel,
    whyMoving: input.whyMoving,
    conditionsPassed: built.matrix.passed,
    conditionsTotal: built.matrix.total,
    matrix: built.matrix,
    nearActive: near,
    alertAt: levels.trigger,
    entryZone: {
      low: levels.entryZoneLow,
      high: levels.entryZoneHigh,
      executable: built.zoneExecutable,
    },
    stop: levels.stop,
    target1: levels.target1,
    target2: levels.target2,
    setupScore,
    lastPrice: input.snapshot.lastPrice,
    rewardToRisk: built.rewardToRisk,
    dataFresh: freshness.ok,
    evaluatedAt,
    relativeMomentum: input.relativeMomentum ?? null,
    session: {
      session: session.session,
      etLabel: session.etLabel,
      tightenConfirmation: session.tightenConfirmation,
      reason: profile.reason,
    },
    regime: input.regimeInfo ?? null,
    historicalEdge: input.historicalEdge ?? null,
    matchedStrategies: input.matchedStrategies ?? [],
    options: input.options ?? null,
  };
}


