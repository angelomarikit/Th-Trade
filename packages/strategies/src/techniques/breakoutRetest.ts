import { conservativeEntryPriceForRisk } from "@wulu/domain";
import { longLevels, shortLevels } from "../helpers.js";
import {
  breakBarVolumeRatio,
  swingResistance,
  swingSupport,
} from "./bars.js";
import { htfForConfirmations } from "./htfForConfirmations.js";
import {
  buildBreakoutRetestConfirmations,
  closesFrom5m,
} from "./confirmations/breakoutRetestConfirmations.js";
import type { TechniqueContext, TechniqueEvaluation } from "./types.js";
import { lastCompleted, toTradeLevels } from "./types.js";

export function evaluateBreakoutRetest(ctx: TechniqueContext): TechniqueEvaluation | null {
  if (ctx.enabledFamilies.breakoutRetest === false) return null;
  const bars5m = ctx.snapshot.bars5m;
  const level =
    ctx.side === "LONG" ? swingResistance(bars5m) : swingSupport(bars5m);
  if (level == null) return null;

  const last = lastCompleted(bars5m);
  if (!last) return null;

  const htfPack = htfForConfirmations(ctx.snapshot);
  const htf = htfPack.primary;
  const closes = closesFrom5m(ctx.snapshot);
  const breakVol = breakBarVolumeRatio(bars5m, level, ctx.side);

  let phase = "WATCHING";
  const completed = bars5m.filter((b) => b.completed);
  const broke = completed.some((b) =>
    ctx.side === "LONG" ? b.close > level : b.close < level,
  );
  const failedHold =
    last.high > level && last.close < level && ctx.side === "LONG"
      ? true
      : last.low < level && last.close > level && ctx.side === "SHORT";

  if (failedHold) phase = "FAILED_BREAK";
  else if (broke && (ctx.side === "LONG" ? last.low <= level * 1.002 : last.high >= level * 0.998))
    phase = "RETESTING";
  else if (broke) phase = "BROKE";
  else if (Math.abs(ctx.snapshot.lastPrice - level) / level < 0.008) phase = "NEAR_LEVEL";

  const stop =
    ctx.side === "LONG"
      ? Math.min(last.low, swingSupport(bars5m) ?? last.low) * 0.999
      : Math.max(last.high, swingResistance(bars5m) ?? last.high) * 1.001;
  const lv =
    ctx.side === "LONG"
      ? longLevels(level, stop, ctx.config.minRewardToRisk, ctx.config.minRewardToRisk * 1.5)
      : shortLevels(level, stop, ctx.config.minRewardToRisk, ctx.config.minRewardToRisk * 1.5);
  const levels = toTradeLevels(ctx.side, level, lv.stop, lv.target1, lv.target2);

  const entryForRr = conservativeEntryPriceForRisk(levels, ctx.snapshot.lastPrice);

  const structure = {
    id: "STRUCTURE" as const,
    status:
      failedHold
        ? ("FAIL" as const)
        : broke
          ? ("PASS" as const)
          : ("WAITING" as const),
    reason: failedHold
      ? `Failed hold: wick beyond ${level.toFixed(2)} but close ${last.close.toFixed(2)} back inside`
      : broke
        ? `Structure: ${ctx.side === "LONG" ? "break" : "breakdown"} vs ${level.toFixed(2)} observed`
        : `Waiting for ${ctx.side === "LONG" ? "break above" : "break below"} ${level.toFixed(2)}`,
    requiredForEntry: true,
  };

  const checks = buildBreakoutRetestConfirmations({
    side: ctx.side,
    bars5m,
    bars1m: ctx.snapshot.bars1m,
    lastPrice: ctx.snapshot.lastPrice,
    level,
    config: ctx.config,
    htf1h: htfPack.htf1h,
    htf15m: htfPack.htf15m,
    native1h: htfPack.native1h,
    native15m: htfPack.native15m,
    closes,
    breakVol,
    entryForRr,
    stop: levels.stop,
    target1: levels.target1,
    structure,
  });

  let score = 35;
  if (phase === "NEAR_LEVEL" || phase === "RETESTING") score += 25;
  if (phase === "BROKE") score += 15;
  if (failedHold) score = 10;
  if (htf === (ctx.side === "LONG" ? "BULLISH" : "BEARISH")) score += 15;

  const statusReason =
    failedHold
      ? "Breakout failed — wait or skip; do not enter on touch alone"
      : checks.every((c) => c.requiredForEntry && c.status === "PASS")
        ? "All breakout+retest confirmations met"
        : `Breakout+retest ${phase} — confirmations incomplete`;

  return {
    strategyId: ctx.side === "LONG" ? "BREAKOUT_RETEST_LONG" : "BREAKDOWN_RETEST_SHORT",
    strategyName: ctx.side === "LONG" ? "Breakout + Retest" : "Breakdown + Retest",
    family: "breakoutRetest",
    side: ctx.side,
    relevanceScore: Math.min(100, score),
    phase,
    levels,
    checks,
    invalidationRules: [
      ctx.side === "LONG"
        ? `5m close back below ${level.toFixed(2)} after break`
        : `5m close back above ${level.toFixed(2)} after breakdown`,
      `Stop below ${levels.stop.toFixed(2)} (structural)`,
    ],
    trendContext: htfPack.trendContextSuffix,
    entryTriggerDescription: `Trigger ${level.toFixed(2)} — completed 5m close + retest hold when Model B active`,
    statusReason,
    htfTrend: htf,
  };
}
