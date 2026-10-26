import { conservativeEntryPriceForRisk } from "@wulu/domain";
import { ema, longLevels, shortLevels } from "../helpers.js";
import { htfForConfirmations } from "./htfForConfirmations.js";
import { buildEmaPullbackConfirmations } from "./confirmations/emaPullbackConfirmations.js";
import { closesFrom5m } from "./confirmations/primitives.js";
import type { TechniqueContext, TechniqueEvaluation } from "./types.js";
import { lastCompleted, toTradeLevels } from "./types.js";

export function evaluateEmaPullback(ctx: TechniqueContext): TechniqueEvaluation | null {
  if (ctx.enabledFamilies.momentumContinuation === false) return null;

  const bars5m = ctx.snapshot.bars5m;
  const completed = bars5m.filter((b) => b.completed);
  if (completed.length < 25) return null;

  const closes = completed.map((b) => b.close);
  const e9 = ema(closes, 9);
  const e20 = ema(closes, 20);
  const ema9 = e9.at(-1)!;
  const ema20 = e20.at(-1)!;
  const last = lastCompleted(bars5m)!;
  const htfPack = htfForConfirmations(ctx.snapshot);
  const htf = htfPack.primary;

  const trendLong = ema9 > ema20 && last.close > ema20;
  const trendShort = ema9 < ema20 && last.close < ema20;
  if (ctx.side === "LONG" && !trendLong) return null;
  if (ctx.side === "SHORT" && !trendShort) return null;

  const touchedPullback =
    ctx.side === "LONG"
      ? completed.slice(-4).some((b) => b.low <= ema20 * 1.001)
      : completed.slice(-4).some((b) => b.high >= ema20 * 0.999);

  const continuation =
    ctx.side === "LONG"
      ? last.close > ema9 && last.close > last.open
      : last.close < ema9 && last.close < last.open;

  if (!touchedPullback && !continuation) return null;

  const trigger = ema9;
  const stop =
    ctx.side === "LONG"
      ? Math.min(ema20, last.low) * 0.998
      : Math.max(ema20, last.high) * 1.002;
  const lv =
    ctx.side === "LONG"
      ? longLevels(trigger, stop, ctx.config.minRewardToRisk, ctx.config.minRewardToRisk * 1.5)
      : shortLevels(trigger, stop, ctx.config.minRewardToRisk, ctx.config.minRewardToRisk * 1.5);
  const levels = toTradeLevels(ctx.side, trigger, lv.stop, lv.target1, lv.target2);
  const entryForRr = conservativeEntryPriceForRisk(levels, ctx.snapshot.lastPrice);

  const structure = {
    id: "STRUCTURE" as const,
    status: continuation ? ("PASS" as const) : ("WAITING" as const),
    reason: `EMA9/20 ${ctx.side === "LONG" ? "up" : "down"} trend · 9=${ema9.toFixed(2)} 20=${ema20.toFixed(2)}${
      touchedPullback ? " · pullback to 20 EMA zone" : ""
    }`,
    requiredForEntry: true,
  };

  const checks = buildEmaPullbackConfirmations({
    side: ctx.side,
    bars5m,
    bars1m: ctx.snapshot.bars1m,
    lastPrice: ctx.snapshot.lastPrice,
    ema9,
    config: ctx.config,
    htf1h: htfPack.htf1h,
    htf15m: htfPack.htf15m,
    native1h: htfPack.native1h,
    native15m: htfPack.native15m,
    closes: closesFrom5m(ctx.snapshot),
    entryForRr,
    stop: levels.stop,
    target1: levels.target1,
    structure,
  });

  let score = 40;
  if (continuation) score += 25;
  if (touchedPullback) score += 20;

  return {
    strategyId: ctx.side === "LONG" ? "EMA_PULLBACK_LONG" : "EMA_PULLBACK_SHORT",
    strategyName: "EMA 9/20 Pullback Continuation",
    family: "momentumContinuation",
    side: ctx.side,
    relevanceScore: Math.min(100, score),
    phase: continuation ? "CONTINUATION" : "PULLBACK",
    levels,
    checks,
    invalidationRules: [
      ctx.side === "LONG"
        ? `Close below 20 EMA ${ema20.toFixed(2)}`
        : `Close above 20 EMA ${ema20.toFixed(2)}`,
      `Stop ${levels.stop.toFixed(2)}`,
    ],
    trendContext: `${htfPack.trendContextSuffix} · EMA stack ${ctx.side === "LONG" ? "bullish" : "bearish"}`,
    entryTriggerDescription: "Pullback to 20 EMA in 9/20 trend then 5m continuation close",
    statusReason: continuation
      ? "EMA continuation candle — verify volume and R:R"
      : "Pullback forming — wait for continuation close",
    htfTrend: htf,
  };
}
