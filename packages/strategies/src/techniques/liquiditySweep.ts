import { conservativeEntryPriceForRisk } from "@wulu/domain";
import { longLevels, shortLevels } from "../helpers.js";
import { htfTrend, swingResistance, swingSupport } from "./bars.js";
import {
  checkExtension,
  checkFiveMinClose,
  checkHtfRegime,
  checkRiskReward,
  checkRsi,
  checkVolume,
  checkVwapSide,
  closesFromSnapshot,
  mergeRrChecks,
} from "./sharedChecks.js";
import type { TechniqueContext, TechniqueEvaluation } from "./types.js";
import { lastCompleted, toTradeLevels } from "./types.js";

export function evaluateLiquiditySweep(ctx: TechniqueContext): TechniqueEvaluation | null {
  if (ctx.enabledFamilies.failedBreakoutReversal === false) return null;

  const bars5m = ctx.snapshot.bars5m;
  const poolHigh = swingResistance(bars5m);
  const poolLow = swingSupport(bars5m);
  if (poolHigh == null || poolLow == null) return null;

  const last = lastCompleted(bars5m);
  const prev = bars5m.filter((b) => b.completed).at(-2);
  if (!last || !prev) return null;

  const htf = htfTrend(bars5m);
  const closes = closesFromSnapshot(ctx.snapshot);

  const sweepShort =
    ctx.side === "SHORT" &&
    prev.high > poolHigh &&
    last.close < poolHigh &&
    last.close < last.open;
  const sweepLong =
    ctx.side === "LONG" &&
    prev.low < poolLow &&
    last.close > poolLow &&
    last.close > last.open;

  if (!sweepShort && !sweepLong) return null;

  const level = ctx.side === "SHORT" ? poolHigh : poolLow;
  const phase = "SWEEP_REVERSAL";
  const stop =
    ctx.side === "SHORT"
      ? Math.max(prev.high, last.high) * 1.001
      : Math.min(prev.low, last.low) * 0.999;
  const lv =
    ctx.side === "SHORT"
      ? shortLevels(last.close, stop, ctx.config.minRewardToRisk, ctx.config.minRewardToRisk * 1.5)
      : longLevels(last.close, stop, ctx.config.minRewardToRisk, ctx.config.minRewardToRisk * 1.5);
  const levels = toTradeLevels(ctx.side, level, lv.stop, lv.target1, lv.target2);
  const entryForRr = conservativeEntryPriceForRisk(levels, ctx.snapshot.lastPrice);

  const checks = [
    checkHtfRegime(htf, ctx.side),
    checkFiveMinClose(bars5m, ctx.side, level, ctx.config),
    checkVolume(bars5m, ctx.config),
    checkRsi(closes, ctx.side, ctx.config),
    checkVwapSide(ctx.snapshot.bars1m, bars5m, ctx.snapshot.lastPrice, ctx.side),
    {
      id: "STRUCTURE" as const,
      status: "PASS" as const,
      reason:
        ctx.side === "SHORT"
          ? `Liquidity sweep: pierced ${poolHigh.toFixed(2)} then closed back below`
          : `Liquidity sweep: pierced ${poolLow.toFixed(2)} then closed back above`,
      requiredForEntry: true,
    },
    mergeRrChecks(
      checkExtension(ctx.snapshot.lastPrice, level, bars5m, ctx.side, ctx.config),
      checkRiskReward(entryForRr, levels.stop, levels.target1, ctx.config),
    ),
  ];

  return {
    strategyId: ctx.side === "SHORT" ? "LIQUIDITY_SWEEP_SHORT" : "LIQUIDITY_SWEEP_LONG",
    strategyName: "Liquidity Sweep + Reversal",
    family: "failedBreakoutReversal",
    side: ctx.side,
    relevanceScore: 75,
    phase,
    levels,
    checks,
    invalidationRules: [
      ctx.side === "SHORT"
        ? `New high above sweep high ${prev.high.toFixed(2)}`
        : `New low below sweep low ${prev.low.toFixed(2)}`,
      `Stop ${levels.stop.toFixed(2)}`,
    ],
    trendContext: `HTF: ${htf} · sweep of ${level.toFixed(2)} pool`,
    entryTriggerDescription: "Stop-run through prior swing pool then 5m rejection close",
    statusReason: "Sweep reversal pattern — confirm R:R and volume",
    htfTrend: htf,
  };
}
