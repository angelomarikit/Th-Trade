import { loadConfirmationConfig } from "@wulu/domain";
import type { TradeSide } from "@wulu/domain";
import type { MarketSnapshot } from "@wulu/market-data";
import { evaluateBreakoutRetest } from "./breakoutRetest.js";
import { evaluateEmaPullback } from "./emaPullback.js";
import { evaluateLiquiditySweep } from "./liquiditySweep.js";
import { evaluateOrb } from "./orb.js";
import { evaluateVwapReclaimRejection } from "./vwapTechnique.js";
import type { TechniqueContext, TechniqueEvaluation } from "./types.js";

const EVALUATORS = [
  evaluateLiquiditySweep,
  evaluateOrb,
  evaluateVwapReclaimRejection,
  evaluateBreakoutRetest,
  evaluateEmaPullback,
];

export interface SelectPrimaryInput {
  symbol: string;
  side: TradeSide;
  snapshot: MarketSnapshot;
  now?: Date;
  enabledFamilies?: Record<string, boolean | undefined>;
  regimePrimary?: string;
  config?: ReturnType<typeof loadConfirmationConfig>;
}

export function selectPrimaryTechnique(input: SelectPrimaryInput): TechniqueEvaluation {
  const config = input.config ?? loadConfirmationConfig();
  const ctx: TechniqueContext = {
    symbol: input.symbol,
    side: input.side,
    snapshot: input.snapshot,
    config,
    now: input.now ?? new Date(),
    enabledFamilies: input.enabledFamilies ?? {},
    regimePrimary: input.regimePrimary,
  };

  const candidates: TechniqueEvaluation[] = [];
  for (const fn of EVALUATORS) {
    const ev = fn(ctx);
    if (ev && ev.side === input.side) candidates.push(ev);
  }

  candidates.sort((a, b) => b.relevanceScore - a.relevanceScore);
  const best = candidates[0];
  if (best && best.relevanceScore >= config.minTechniqueScore) {
    return best;
  }

  const fallback = evaluateBreakoutRetest(ctx);
  if (fallback) {
    return {
      ...fallback,
      strategyName: fallback.strategyName + " (structure watch)",
      relevanceScore: Math.max(fallback.relevanceScore, config.minTechniqueScore),
      statusReason: "Primary pattern weak — monitoring structural breakout level",
    };
  }

  return {
    strategyId: "STRUCTURAL_WATCH",
    strategyName: "Structural Watch",
    family: "breakoutRetest",
    side: input.side,
    relevanceScore: config.minTechniqueScore,
    phase: "WATCHING",
    levels: {
      side: input.side,
      trigger: input.snapshot.lastPrice,
      entryZoneLow: input.snapshot.lastPrice * 0.999,
      entryZoneHigh: input.snapshot.lastPrice * 1.001,
      stop: input.snapshot.lastPrice * 0.99,
      target1: input.snapshot.lastPrice * 1.02,
      target2: input.snapshot.lastPrice * 1.03,
      invalidation: input.snapshot.lastPrice * 0.99,
    },
    checks: [],
    invalidationRules: ["Insufficient bar history for technique detection"],
    trendContext: "UNKNOWN",
    entryTriggerDescription: "Waiting for data",
    statusReason: "Collecting bars for technique analysis",
    htfTrend: "UNKNOWN",
  };
}

export function listTechniqueCandidates(input: SelectPrimaryInput): TechniqueEvaluation[] {
  const config = input.config ?? loadConfirmationConfig();
  const ctx: TechniqueContext = {
    symbol: input.symbol,
    side: input.side,
    snapshot: input.snapshot,
    config,
    now: input.now ?? new Date(),
    enabledFamilies: input.enabledFamilies ?? {},
    regimePrimary: input.regimePrimary,
  };
  return EVALUATORS.map((fn) => fn(ctx)).filter((x): x is TechniqueEvaluation => x != null);
}
