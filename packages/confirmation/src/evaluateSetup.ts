import type { SetupState, TradeSide } from "@wulu/domain";
import { loadConfirmationConfig } from "@wulu/domain";
import { selectPrimaryTechnique } from "@wulu/strategies";
import {
  assessFreshness,
  buildMarketDataFreshnessBreakdown,
  classifyUsEquitySession,
  confirmationProfileForSession,
  describeQuoteBlock,
  isQuoteUsableForEntry,
  lastCompletedBar,
  referencePriceExplanation,
  resolvePriceSource,
  type MarketSnapshot,
} from "@wulu/market-data";
import type { WhyMovingBlock } from "@wulu/news";
import { analyzeBreakout } from "./breakoutAnalysis.js";
import { type AlignmentInput } from "./buildMatrix.js";
import { buildTechniqueConditionMatrix } from "./buildTechniqueMatrix.js";
import { detectFakeBreakoutRisk, worstFakeBreakoutSeverity } from "./fakeBreakout.js";
import { buildNearActiveView } from "./nearActive.js";
import { scoreSetupQuality10 } from "./qualityScore10.js";
import { evaluateRetest, type RetestPhase } from "./retest.js";
import { setupScoreFromMatrix } from "./scoreFromMatrix.js";
import { shapeSnapshotForLabEnter } from "./labEnterSnapshot.js";
import { applyLabMockEnterDrill } from "./labMockEnter.js";
import { pickLabMockEnterSide } from "./pickLabMockEnterSide.js";
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
  /** Preview-only: relax stale-data limits off RTH so gates can be exercised on latest SIP snapshot. */
  labMode?: boolean;
  /** Lab-only: apply RTH session + gate profile to off-hours SIP replay (acceptance testing). */
  mockRth?: boolean;
  /** Lab + sim RTH: force ENTRY ACTIVE for mock paper trading (API `mockEnter=1`). */
  mockEnter?: boolean;
}

export function evaluateSetup(input: EvaluateSetupInput): LiveSetupCard {
  const now = input.now ?? new Date();
  const labMode = input.labMode === true;
  const realSession = classifyUsEquitySession(now);
  const simulateRth = labMode && input.mockRth === true && !realSession.isRegularHours;
  const session = simulateRth
    ? {
        session: "RTH" as const,
        etLabel: `${realSession.etLabel} · SIMULATED RTH`,
        isRegularHours: true,
        tightenConfirmation: true,
        maxDataAgeMs: 90_000,
        reason:
          "Lab simulated RTH — last SIP snapshot replayed with regular-session rules (not live clock)",
      }
    : realSession;
  const wantsMockEnter = input.mockEnter === true && simulateRth;
  const labMockEnterAuthorizedSide = wantsMockEnter
    ? pickLabMockEnterSide(input.snapshot)
    : undefined;
  const mockEnterActive =
    wantsMockEnter && labMockEnterAuthorizedSide === input.side;

  let snapshot = input.snapshot;
  if (mockEnterActive) {
    snapshot = shapeSnapshotForLabEnter(snapshot, input.side, now);
  }
  let profile = confirmationProfileForSession(session);
  const confirmationConfig = loadConfirmationConfig();
  profile = {
    ...profile,
    minRelativeVolume: confirmationConfig.minRelativeVolume,
    minRewardToRisk: confirmationConfig.minRewardToRisk,
    maxSpreadPct: confirmationConfig.maxSpreadPct,
  };
  let freshnessMax = profile.maxDataAgeMs;
  /** Preview lab: allow last session SIP snapshot through weekend/closed. */
  const LAB_CLOSED_SESSION_MAX_AGE_MS = 96 * 60 * 60 * 1000;
  if (labMode && !realSession.isRegularHours) {
    if (realSession.maxDataAgeMs === 0) freshnessMax = LAB_CLOSED_SESSION_MAX_AGE_MS;
    else freshnessMax = Math.max(freshnessMax, 300_000);
  }
  let freshness = assessFreshness(snapshot, now, freshnessMax, realSession);
  if (simulateRth && snapshot.bars5m.length >= 8) {
    freshness = {
      ok: true,
      ageMs: freshness.ageMs,
      maxAgeMs: freshness.maxAgeMs,
      reason: "Simulated RTH — snapshot verified for lab gate drill",
    };
  }
  const quoteOk = isQuoteUsableForEntry(snapshot, profile.maxSpreadPct);
  const priceSource = resolvePriceSource(snapshot);
  const referencePriceOnly = priceSource !== "quote_mid";
  if (
    !quoteOk &&
    !simulateRth &&
    (realSession.session === "RTH" ||
      realSession.session === "PREMARKET" ||
      realSession.session.includes("HOUR"))
  ) {
    freshness = {
      ok: false,
      ageMs: freshness.ageMs,
      maxAgeMs: freshness.maxAgeMs,
      reason: `${
        describeQuoteBlock(snapshot, profile.maxSpreadPct) ??
        "Live bid/ask not trustworthy for entry"
      } — ENTER blocked; levels use last RTH bar as reference only.`,
    };
  }
  const technique = selectPrimaryTechnique({
    symbol: input.symbol,
    side: input.side,
    snapshot,
    now,
    enabledFamilies: input.regimeInfo?.strategyGates ?? {},
    regimePrimary: input.regimeInfo?.primary,
    config: confirmationConfig,
  });
  const levels = technique.levels;

  const breakout = analyzeBreakout({
    side: input.side,
    bars5m: snapshot.bars5m,
    trigger: levels.trigger,
  });

  const preferRetest =
    input.preferRetestModel ??
    (technique.family === "breakoutRetest" || technique.strategyId.includes("BREAKOUT"));
  const retest = evaluateRetest({
    side: input.side,
    bars5m: snapshot.bars5m,
    level: levels.trigger,
    previousPhase: input.previousRetestPhase,
    preferRetestModel: preferRetest,
  });

  const fakeWarnings = detectFakeBreakoutRisk({
    side: input.side,
    bars5m: snapshot.bars5m,
    trigger: levels.trigger,
    rvol: input.relativeMomentum?.rvol ?? null,
    minRvol: profile.minRelativeVolume,
    retestFailed: retest.phase === "RETEST_FAILED",
  });
  const falseBreakoutRisk = worstFakeBreakoutSeverity(fakeWarnings);

  const built = buildTechniqueConditionMatrix({
    technique,
    levels,
    snapshot,
    freshness,
    whyMoving: input.whyMoving,
    profile,
    evaluatedAt: now,
  });

  const matchedFromTechnique: MatchedStrategyInfo[] = [
    {
      strategyId: technique.strategyId,
      strategyName: technique.strategyName,
      family: technique.family,
      reason: technique.statusReason,
    },
  ];

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
      ? snapshot.lastPrice < levels.stop
      : snapshot.lastPrice > levels.stop;
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
    lastPrice: snapshot.lastPrice,
    dataTimestamp: evaluatedAt,
    setupQualityScore: setupScore.total,
  });

  const actionHint = actionHintFor(state, breakout.mode, retest, falseBreakoutRisk, freshness.ok);
  const setupId = `${input.symbol.toUpperCase()}:${input.side}:${levels.trigger.toFixed(4)}`;
  const indicatorChecklist = buildIndicatorChecklist({
    side: input.side,
    snapshot: snapshot,
    levels,
    dataFresh: freshness.ok,
    minRvol: profile.minRelativeVolume,
  });

  const liquidityMeta = evaluateLiquidity(snapshot.quote, profile.maxSpreadPct, {
    maxQuoteAgeMs: profile.maxDataAgeMs,
    now,
  });
  const entryGeometry = describeEntryGeometry(
    input.side,
    levels,
    snapshot.lastPrice,
    near.statusLabel,
  );

  let card: LiveSetupCard = {
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
    lastPrice: snapshot.lastPrice,
    lastCompletedBar: (() => {
      const b = lastCompletedBar(snapshot.bars5m);
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
        snapshot,
        freshness.ok,
        freshness.reason,
        now,
        session,
        freshness.maxAgeMs,
      );
      return freshness.ok ? freshness.reason : breakdown.summary;
    })(),
    marketDataStatus: buildMarketDataFreshnessBreakdown(
      snapshot,
      freshness.ok,
      freshness.reason,
      now,
      session,
      freshness.maxAgeMs,
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
    matchedStrategies: matchedFromTechnique,
    activeTechnique: {
      strategyId: technique.strategyId,
      strategyName: technique.strategyName,
      family: technique.family,
      phase: technique.phase,
      trendContext: technique.trendContext,
      entryTriggerDescription: technique.entryTriggerDescription,
      statusReason: technique.statusReason,
      invalidationRules: technique.invalidationRules,
      htfTrend: technique.htfTrend,
      relevanceScore: technique.relevanceScore,
      confirmations: built.matrix.rows.map((r) => ({
        id: r.id,
        label: r.label,
        status: r.status,
        reason: r.reason,
        required: r.requiredForEntry,
      })),
    },
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
    labMode: labMode && !realSession.isRegularHours ? true : undefined,
    mockRth: simulateRth ? true : undefined,
    labMockEnterAuthorizedSide: labMockEnterAuthorizedSide,
    labDisclaimer: simulateRth
      ? "SIMULATED RTH (lab) — replays last SIP bars with live RTH rules. Clock is still off-hours; no broker orders."
      : labMode && !realSession.isRegularHours
        ? "LAB TEST — not live RTH. Latest SIP snapshot for gate preview only; live ENTRY remains blocked."
        : undefined,
  };

  if (mockEnterActive) {
    card = applyLabMockEnterDrill(card);
  } else if (wantsMockEnter && labMockEnterAuthorizedSide) {
    card = {
      ...card,
      labDisclaimer: `SIMULATED RTH (lab) — mock ENTER only on ${labMockEnterAuthorizedSide} for this snapshot; ${input.side} stays blocked like live.`,
    };
  }
  return card;
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
