import { conservativeEntryPriceForRisk } from "@wulu/domain";
import { vwap, longLevels, shortLevels } from "../helpers.js";
import { htfTrend } from "./bars.js";
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

export function evaluateVwapReclaimRejection(ctx: TechniqueContext): TechniqueEvaluation | null {
  const family =
    ctx.side === "LONG" ? "vwapReclaim" : "vwapRejection";
  if (ctx.enabledFamilies[family] === false) return null;

  const bars1m = ctx.snapshot.bars1m;
  const bars5m = ctx.snapshot.bars5m;
  const bars = bars1m.filter((b) => b.completed).length >= 10 ? bars1m : bars5m;
  const completed = bars.filter((b) => b.completed);
  const v = vwap(completed);
  if (v == null || completed.length < 3) return null;

  const prev = completed.at(-2)!;
  const last = lastCompleted(bars5m) ?? completed.at(-1)!;
  const htf = htfTrend(bars5m);
  const closes = closesFromSnapshot(ctx.snapshot);

  const reclaim =
    ctx.side === "LONG" && prev.close < v && last.close > v;
  const rejection =
    ctx.side === "SHORT" && prev.close > v && last.close < v;
  const holding =
    ctx.side === "LONG"
      ? ctx.snapshot.lastPrice >= v
      : ctx.snapshot.lastPrice <= v;

  if (!holding && !reclaim && !rejection) return null;

  let phase = "WATCHING_VWAP";
  if (reclaim || rejection) phase = "VWAP_CROSS_CONFIRMED";
  else if (holding) phase = "HOLDING_VWAP_SIDE";

  const stop =
    ctx.side === "LONG"
      ? Math.min(prev.low, last.low) * 0.999
      : Math.max(prev.high, last.high) * 1.001;
  const lv =
    ctx.side === "LONG"
      ? longLevels(v, stop, ctx.config.minRewardToRisk, ctx.config.minRewardToRisk * 1.5)
      : shortLevels(v, stop, ctx.config.minRewardToRisk, ctx.config.minRewardToRisk * 1.5);
  const levels = toTradeLevels(ctx.side, v, lv.stop, lv.target1, lv.target2);

  const entryForRr = conservativeEntryPriceForRisk(levels, ctx.snapshot.lastPrice);

  const checks = [
    checkHtfRegime(htf, ctx.side),
    checkFiveMinClose(bars5m, ctx.side, v, ctx.config),
    checkVolume(bars5m, ctx.config),
    checkRsi(closes, ctx.side, ctx.config),
    checkVwapSide(bars1m, bars5m, ctx.snapshot.lastPrice, ctx.side),
    {
      id: "STRUCTURE" as const,
      status: reclaim || rejection ? ("PASS" as const) : holding ? ("WAITING" as const) : ("WAITING" as const),
      reason:
        reclaim
          ? `VWAP reclaim: prior close below, last close above ${v.toFixed(2)}`
          : rejection
            ? `VWAP rejection: prior close above, last close below ${v.toFixed(2)}`
            : `Waiting for VWAP ${ctx.side === "LONG" ? "reclaim" : "rejection"} cross on 5m`,
      requiredForEntry: true,
    },
    mergeRrChecks(
      checkExtension(ctx.snapshot.lastPrice, v, bars5m, ctx.side, ctx.config),
      checkRiskReward(entryForRr, levels.stop, levels.target1, ctx.config),
    ),
  ];

  let score = 30;
  if (reclaim || rejection) score += 35;
  else if (holding) score += 20;
  if (htf === (ctx.side === "LONG" ? "BULLISH" : "BEARISH")) score += 10;

  return {
    strategyId: ctx.side === "LONG" ? "VWAP_RECLAIM" : "VWAP_REJECTION",
    strategyName: ctx.side === "LONG" ? "VWAP Reclaim" : "VWAP Rejection",
    family,
    side: ctx.side,
    relevanceScore: Math.min(100, score),
    phase,
    levels,
    checks,
    invalidationRules: [
      ctx.side === "LONG"
        ? `Close back below VWAP ${v.toFixed(2)}`
        : `Close back above VWAP ${v.toFixed(2)}`,
      `Structural stop ${levels.stop.toFixed(2)}`,
    ],
    trendContext: `HTF: ${htf} · VWAP ${v.toFixed(2)}`,
    entryTriggerDescription: `${ctx.side === "LONG" ? "Reclaim" : "Reject"} VWAP with completed 5m close`,
    statusReason:
      reclaim || rejection
        ? "VWAP cross detected — awaiting full confirmation stack"
        : "Price on correct side of VWAP — waiting for cross confirmation",
    htfTrend: htf,
  };
}
