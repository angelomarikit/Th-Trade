import type { ConditionId, ConditionStatus, TradeSide, TradeLevels } from "@wulu/domain";
import type { ConfirmationConfig } from "@wulu/domain";
import type { Bar, MarketSnapshot } from "@wulu/market-data";
import type { HtfBias } from "./bars.js";

export interface TechniqueCheck {
  id: ConditionId;
  status: ConditionStatus;
  reason: string;
  requiredForEntry: boolean;
}

export interface TechniqueEvaluation {
  strategyId: string;
  strategyName: string;
  family: string;
  side: TradeSide;
  /** 0–100 pattern fit for this side */
  relevanceScore: number;
  phase: string;
  levels: TradeLevels;
  checks: TechniqueCheck[];
  invalidationRules: string[];
  trendContext: string;
  entryTriggerDescription: string;
  statusReason: string;
  htfTrend: HtfBias;
}

export interface TechniqueContext {
  symbol: string;
  side: TradeSide;
  snapshot: MarketSnapshot;
  config: ConfirmationConfig;
  now: Date;
  enabledFamilies: Record<string, boolean | undefined>;
  regimePrimary?: string;
  trendDirection?: "BULLISH" | "BEARISH" | "RANGE";
}

export type TechniqueEvaluator = (ctx: TechniqueContext) => TechniqueEvaluation | null;

export function toTradeLevels(
  side: TradeSide,
  trigger: number,
  stop: number,
  target1: number,
  target2: number,
  target3?: number,
): TradeLevels {
  const entryLow = side === "LONG" ? trigger : trigger * 0.997;
  const entryHigh = side === "LONG" ? trigger * 1.003 : trigger;
  return {
    side,
    trigger,
    entryZoneLow: Math.min(entryLow, entryHigh),
    entryZoneHigh: Math.max(entryLow, entryHigh),
    stop,
    target1,
    target2,
    target3,
    invalidation: stop,
  };
}

export function completed5m(bars: Bar[]): Bar[] {
  return bars.filter((b) => b.completed);
}

export function lastCompleted(bars: Bar[]): Bar | null {
  const c = completed5m(bars);
  return c.at(-1) ?? null;
}
