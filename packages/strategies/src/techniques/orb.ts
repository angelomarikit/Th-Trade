import { conservativeEntryPriceForRisk } from "@wulu/domain";
import { longLevels, shortLevels } from "../helpers.js";
import { htfTrend, openingRangeEt } from "./bars.js";
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

export function evaluateOrb(ctx: TechniqueContext): TechniqueEvaluation | null {
  if (ctx.enabledFamilies.openingRangeBreakout === false) return null;

  const bars1m = ctx.snapshot.bars1m;
  const bars5m = ctx.snapshot.bars5m;
  const or = openingRangeEt(
    bars1m.length >= 20 ? bars1m : bars5m,
    ctx.config.orbMinutes,
    ctx.now,
  );
  if (!or || !or.complete) return null;

  const trigger = ctx.side === "LONG" ? or.high : or.low;
  const last = lastCompleted(bars5m);
  if (!last) return null;

  const htf = htfTrend(bars5m);
  const closes = closesFromSnapshot(ctx.snapshot);

  const broke =
    ctx.side === "LONG" ? last.close > or.high : last.close < or.low;
  const near =
    ctx.side === "LONG"
      ? ctx.snapshot.lastPrice >= or.high * 0.998
      : ctx.snapshot.lastPrice <= or.low * 1.002;

  if (!broke && !near) return null;

  const phase = broke ? "ORB_BREAK" : "ORB_APPROACH";
  const stop =
    ctx.side === "LONG"
      ? or.low * 0.999
      : or.high * 1.001;
  const lv =
    ctx.side === "LONG"
      ? longLevels(trigger, stop, ctx.config.minRewardToRisk, ctx.config.minRewardToRisk * 1.5)
      : shortLevels(trigger, stop, ctx.config.minRewardToRisk, ctx.config.minRewardToRisk * 1.5);
  const levels = toTradeLevels(ctx.side, trigger, lv.stop, lv.target1, lv.target2);
  const entryForRr = conservativeEntryPriceForRisk(levels, ctx.snapshot.lastPrice);

  const checks = [
    checkHtfRegime(htf, ctx.side),
    checkFiveMinClose(bars5m, ctx.side, trigger, ctx.config),
    checkVolume(bars5m, ctx.config),
    checkRsi(closes, ctx.side, ctx.config),
    checkVwapSide(bars1m, bars5m, ctx.snapshot.lastPrice, ctx.side),
    {
      id: "STRUCTURE" as const,
      status: broke ? ("PASS" as const) : ("WAITING" as const),
      reason: broke
        ? `ORB ${ctx.side === "LONG" ? "high" : "low"} ${trigger.toFixed(2)} broken on 5m close`
        : `Approaching ORB ${ctx.side === "LONG" ? "high" : "low"} ${trigger.toFixed(2)}`,
      requiredForEntry: true,
    },
    mergeRrChecks(
      checkExtension(ctx.snapshot.lastPrice, trigger, bars5m, ctx.side, ctx.config),
      checkRiskReward(entryForRr, levels.stop, levels.target1, ctx.config),
    ),
  ];

  let score = broke ? 70 : 45;

  return {
    strategyId: ctx.side === "LONG" ? "ORB_LONG" : "ORB_SHORT",
    strategyName: "Opening Range Breakout",
    family: "openingRangeBreakout",
    side: ctx.side,
    relevanceScore: score,
    phase,
    levels,
    checks,
    invalidationRules: [
      ctx.side === "LONG"
        ? `Close back inside opening range below ${or.high.toFixed(2)}`
        : `Close back inside opening range above ${or.low.toFixed(2)}`,
      `Stop ${levels.stop.toFixed(2)}`,
    ],
    trendContext: `HTF: ${htf} · OR ${or.low.toFixed(2)}–${or.high.toFixed(2)} (${ctx.config.orbMinutes}m ET)`,
    entryTriggerDescription: `Break ${ctx.config.orbMinutes}m opening range ${ctx.side === "LONG" ? "high" : "low"} with 5m close`,
    statusReason: broke ? "ORB break — confirm volume and R:R" : "Near opening range — wait for 5m break close",
    htfTrend: htf,
  };
}
