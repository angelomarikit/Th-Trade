import type { SetupState, TradeSide } from "@wulu/domain";
import {
  assessFreshness,
  buildMarketDataFreshnessBreakdown,
  classifyUsEquitySession,
  confirmationProfileForSession,
  isQuoteUsableForEntry,
  lastCompletedBar,
  referencePriceExplanation,
  resolvePriceSource,
  type MarketSnapshot,
} from "@wulu/market-data";
import type { WhyMovingBlock } from "@wulu/news";
import { analyzeBreakout } from "./breakoutAnalysis.js";
import { buildSetupConditionMatrix, type AlignmentInput } from "./buildMatrix.js";
import { deriveLevels } from "./deriveLevels.js";
import { detectFakeBreakoutRisk, worstFakeBreakoutSeverity } from "./fakeBreakout.js";
import { buildNearActiveView } from "./nearActive.js";
import { scoreSetupQuality10 } from "./qualityScore10.js";
import { evaluateRetest, type RetestPhase } from "./retest.js";
import { setupScoreFromMatrix } from "./scoreFromMatrix.js";
import { assertEntryNotFromNewsAlone, decideSetupState } from "./stateMachine.js";
import { buildIndicatorChecklist } from "./indicatorReadouts.js";
import { describeEntryGeometry } from "./entryGeometry.js";
import { evaluateLiquidity } from "./liquidity.js";
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
  previousRetestPhase?: RetestPhase;
  preferRetestModel?: boolean;
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
  let freshness = assessFreshness(input.snapshot, now, profile.maxDataAgeMs, session);
  const quoteOk = isQuoteUsableForEntry(input.snapshot, profile.maxSpreadPct);
  const priceSource = resolvePriceSource(input.snapshot);
  const referencePriceOnly = priceSource !== "quote_mid";
  if (
    !quoteOk &&
    (session.session === "RTH" || session.session === "PREMARKET" || session.session.includes("HOUR"))
  ) {
    freshness = {
      ok: false,
      ageMs: freshness.ageMs,
      maxAgeMs: freshness.maxAgeMs,
      reason:
        "Live bid/ask not trustworthy for entry (missing, stale, or spread too wide) — levels use last RTH bar as reference only.",
    };
  }
  const levels = deriveLevels(input.snapshot.bars5m, input.side, input.snapshot.lastPrice);

  const breakout = analyzeBreakout({
    side: input.side,
    bars5m: input.snapshot.bars5m,
    trigger: levels.trigger,
  });

  const retest = evaluateRetest({
    side: input.side,
    bars5m: input.snapshot.bars5m,
    level: levels.trigger,
    previousPhase: input.previousRetestPhase,
    preferRetestModel: input.preferRetestModel ?? false,
  });

  const fakeWarnings = detectFakeBreakoutRisk({
    side: input.side,
    bars5m: input.snapshot.bars5m,
    trigger: levels.trigger,
    rvol: input.relativeMomentum?.rvol ?? null,
    minRvol: profile.minRelativeVolume,
    retestFailed: retest.phase === "RETEST_FAILED",
  });
  const falseBreakoutRisk = worstFakeBreakoutSeverity(fakeWarnings);

  const built = buildSetupConditionMatrix({
    side: input.side,
    snapshot: input.snapshot,
    freshness,
    levels,
    whyMoving: input.whyMoving,
    marketRegime: input.marketRegime,
    sectorAlignment: input.sectorAlignment,
    profile,
    evaluatedAt: now,
  });

  const prev = input.previousState;
  const wasNearOrActive =
    prev === "NEAR_ACTIVE" ||
    prev === "ENTRY_ACTIVE_LONG" ||
    prev === "ENTRY_ACTIVE_SHORT";

  const leftZone = wasNearOrActive && !built.zoneExecutable;
  const structureRow = built.matrix.rows.find((r) => r.id === "STRUCTURE");
  const structureInvalidated = wasNearOrActive && structureRow?.status === "FAIL";
  const stopBreached =
    input.side === "LONG"
      ? input.snapshot.lastPrice < levels.stop
      : input.snapshot.lastPrice > levels.stop;
  const fakeBreakoutInvalidated =
    wasNearOrActive &&
    fakeWarnings.some(
      (w) =>
        w.suggestedAction === "INVALIDATE" &&
        w.sideRelevance === input.side &&
        !w.earlyWarning,
    );

  const state = decideSetupState({
    side: input.side,
    matrix: built.matrix,
    zoneExecutable: built.zoneExecutable,
    previousState: input.previousState,
    leftExecutableZone: leftZone,
    structureInvalidated:
      structureInvalidated || fakeBreakoutInvalidated || stopBreached,
  });

  assertEntryNotFromNewsAlone(state, built.matrix);

  const setupScore = setupScoreFromMatrix(built.matrix, {
    catalystQuality: input.catalystQualityScore,
    priceReaction: input.priceReactionScore,
    marketAlignment: input.marketAlignmentScore,
    sectorAlignment: input.sectorAlignmentScore,
  });

  const qualityScore10 = scoreSetupQuality10({
    matrix: built.matrix,
    dataFresh: freshness.ok,
    breakout,
    fakeWarnings,
    retest,
    rvol: input.relativeMomentum?.rvol ?? null,
    rewardToRisk: built.rewardToRisk,
    zoneExecutable: built.zoneExecutable,
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

  const actionHint = actionHintFor(state, breakout.mode, retest, falseBreakoutRisk, freshness.ok);
  const setupId = `${input.symbol.toUpperCase()}:${input.side}:${levels.trigger.toFixed(4)}`;
  const indicatorChecklist = buildIndicatorChecklist({
    side: input.side,
    snapshot: input.snapshot,
    levels,
    dataFresh: freshness.ok,
    minRvol: profile.minRelativeVolume,
  });

  const liquidityMeta = evaluateLiquidity(input.snapshot.quote, profile.maxSpreadPct, {
    maxQuoteAgeMs: profile.maxDataAgeMs,
    now,
  });
  const entryGeometry = describeEntryGeometry(
    input.side,
    levels,
    input.snapshot.lastPrice,
    near.statusLabel,
  );

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
    target3: levels.target3 ?? null,
    invalidation: levels.invalidation ?? levels.stop,
    setupScore,
    qualityScore10,
    signalIntelligence: {
      breakout,
      fakeBreakoutWarnings: fakeWarnings,
      falseBreakoutRisk,
      retest,
      actionHint,
      entryModel: retest.model === "NONE" ? (breakout.mode === "CONFIRMED_CLOSE" ? "CONFIRMED_BREAKOUT" : "NONE") : retest.model,
    },
    lastPrice: input.snapshot.lastPrice,
    lastCompletedBar: (() => {
      const b = lastCompletedBar(input.snapshot.bars5m);
      if (!b) return null;
      return {
        high: b.high,
        low: b.low,
        close: b.close,
        timestamp: b.timestamp.toISOString(),
      };
    })(),
    rewardToRisk: built.rewardToRisk,
    dataFresh: freshness.ok,
    dataFreshReason: (() => {
      const breakdown = buildMarketDataFreshnessBreakdown(
        input.snapshot,
        freshness.ok,
        freshness.reason,
        now,
        session,
      );
      return freshness.ok ? freshness.reason : breakdown.summary;
    })(),
    marketDataStatus: buildMarketDataFreshnessBreakdown(
      input.snapshot,
      freshness.ok,
      freshness.reason,
      now,
      session,
    ),
    evaluatedAt,
    setupId,
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
    indicatorChecklist,
    entryGeometry,
    quoteTransparency: {
      bid: liquidityMeta.bid,
      ask: liquidityMeta.ask,
      spreadPct: liquidityMeta.spreadPct,
      quoteAt: liquidityMeta.quoteAt,
      priceSource,
      referencePriceOnly,
      priceBasis: referencePriceExplanation(priceSource),
    },
  };
}

function actionHintFor(
  state: SetupState,
  breakoutMode: string,
  retest: { phase: string; retestRequired: boolean },
  fakeRisk: string,
  dataFresh: boolean,
): string {
  if (!dataFresh) return "DATA NOT VERIFIED — NO TRADE";
  if (state === "ENTRY_ACTIVE_LONG" || state === "ENTRY_ACTIVE_SHORT") {
    return "ENTRY ACTIVE — all mandatory checks passed; still verify live";
  }
  if (state === "INVALIDATED") return "INVALIDATED — do not trade this setup";
  if (state === "MISSED") return "MISSED — do not chase";
  if (state === "NO_TRADE") return "NO TRADE — mandatory checks failed";
  if (fakeRisk === "CONFIRMED_FAIL") return "WAIT — confirmed trap / failed break pattern";
  if (retest.retestRequired && retest.phase === "WAITING_RETEST") {
    return "WAIT FOR RETEST CONFIRMATION";
  }
  if (breakoutMode === "BREAKING" || breakoutMode === "APPROACHING") {
    return "WAIT FOR CONFIRMATION";
  }
  if (state === "NEAR_ACTIVE") return "WAIT FOR CONFIRMATION";
  return "WAIT";
}
