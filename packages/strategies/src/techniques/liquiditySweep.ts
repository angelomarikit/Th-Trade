import { conservativeEntryPriceForRisk } from "@wulu/domain";
import { longLevels, shortLevels } from "../helpers.js";
import { swingResistance, swingSupport } from "./bars.js";
import { htfForConfirmations } from "./htfForConfirmations.js";
import { buildLiquiditySweepConfirmations } from "./confirmations/liquiditySweepConfirmations.js";
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

  const htfPack = htfForConfirmations(ctx.snapshot);
  const htf = htfPack.primary;

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

  const structure = {
    id: "STRUCTURE" as const,
    status: "PASS" as const,
    reason:
      ctx.side === "SHORT"
        ? `Liquidity sweep: pierced ${poolHigh.toFixed(2)} then closed back below`
        : `Liquidity sweep: pierced ${poolLow.toFixed(2)} then closed back above`,
    requiredForEntry: true,
  };

  const checks = buildLiquiditySweepConfirmations({
    side: ctx.side,
    bars5m,
    lastPrice: ctx.snapshot.lastPrice,
    level,
    config: ctx.config,
    entryForRr,
    stop: levels.stop,
    target1: levels.target1,
    structure,
    htf1h: htfPack.htf1h,
    htf15m: htfPack.htf15m,
    native1h: htfPack.native1h,
    native15m: htfPack.native15m,
  });

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
    trendContext: `${htfPack.trendContextSuffix} · sweep of ${level.toFixed(2)} pool`,
    entryTriggerDescription: "Stop-run through prior swing pool then 5m rejection close",
    statusReason: "Sweep reversal pattern — confirm R:R and volume",
    htfTrend: htf,
  };
}
