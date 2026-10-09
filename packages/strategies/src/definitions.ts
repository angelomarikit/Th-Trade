import type { StrategyDefinition, StrategySignal } from "./types.js";
import { sliceTo } from "./types.js";
import {
  bollinger,
  longLevels,
  macdHistogram,
  openingRange,
  rsi,
  shortLevels,
  vwap,
} from "./helpers.js";

function signal(
  strategyId: string,
  side: "LONG" | "SHORT",
  barIndex: number,
  trigger: number,
  levels: { entry: number; stop: number; target1: number; target2: number },
  reason: string,
): StrategySignal {
  return {
    strategyId,
    side,
    signalBarIndex: barIndex,
    trigger,
    entry: levels.entry,
    stop: levels.stop,
    target1: levels.target1,
    target2: levels.target2,
    reason,
  };
}

export const STRATEGY_DEFINITIONS: StrategyDefinition[] = [
  {
    id: "ORB_LONG",
    name: "Opening Range Breakout",
    version: "1.0.0",
    family: "openingRangeBreakout",
    side: "LONG",
    description: "Break and close above opening range high",
    detect: (ctx) => {
      const bars = sliceTo(ctx);
      if (bars.length < 8) return null;
      const or = openingRange(bars, 30);
      if (!or) return null;
      const last = bars.at(-1)!;
      if (!(last.close > or.high && last.completed)) return null;
      const stop = Math.min(or.low, last.low);
      const levels = longLevels(last.close, stop);
      return signal("ORB_LONG", "LONG", ctx.barIndex, or.high, levels, "OR high break + close");
    },
  },
  {
    id: "ORB_SHORT",
    name: "Opening Range Breakdown",
    version: "1.0.0",
    family: "openingRangeBreakout",
    side: "SHORT",
    description: "Break and close below opening range low",
    detect: (ctx) => {
      const bars = sliceTo(ctx);
      if (bars.length < 8) return null;
      const or = openingRange(bars, 30);
      if (!or) return null;
      const last = bars.at(-1)!;
      if (!(last.close < or.low)) return null;
      const stop = Math.max(or.high, last.high);
      const levels = shortLevels(last.close, stop);
      return signal("ORB_SHORT", "SHORT", ctx.barIndex, or.low, levels, "OR low break + close");
    },
  },
  {
    id: "BREAKOUT_RETEST_LONG",
    name: "Breakout + Retest",
    version: "1.0.0",
    family: "breakoutRetest",
    side: "LONG",
    description: "Prior swing high break then retest hold",
    detect: (ctx) => {
      const bars = sliceTo(ctx);
      if (bars.length < 12) return null;
      const prior = bars.slice(0, -3);
      const level = Math.max(...prior.map((b) => b.high));
      const last3 = bars.slice(-3);
      const broke = last3.some((b) => b.close > level);
      const last = bars.at(-1)!;
      const retestHold = last.low <= level * 1.002 && last.close >= level;
      if (!broke || !retestHold) return null;
      const levels = longLevels(last.close, Math.min(last.low, level * 0.997));
      return signal("BREAKOUT_RETEST_LONG", "LONG", ctx.barIndex, level, levels, "Breakout retest hold");
    },
  },
  {
    id: "BREAKDOWN_RETEST_SHORT",
    name: "Breakdown + Retest",
    version: "1.0.0",
    family: "breakoutRetest",
    side: "SHORT",
    description: "Prior swing low break then retest reject",
    detect: (ctx) => {
      const bars = sliceTo(ctx);
      if (bars.length < 12) return null;
      const prior = bars.slice(0, -3);
      const level = Math.min(...prior.map((b) => b.low));
      const last3 = bars.slice(-3);
      const broke = last3.some((b) => b.close < level);
      const last = bars.at(-1)!;
      const retestReject = last.high >= level * 0.998 && last.close <= level;
      if (!broke || !retestReject) return null;
      const levels = shortLevels(last.close, Math.max(last.high, level * 1.003));
      return signal("BREAKDOWN_RETEST_SHORT", "SHORT", ctx.barIndex, level, levels, "Breakdown retest reject");
    },
  },
  {
    id: "VWAP_RECLAIM",
    name: "VWAP Reclaim",
    version: "1.0.0",
    family: "vwapReclaim",
    side: "LONG",
    description: "Close back above VWAP after trading below",
    detect: (ctx) => {
      const bars = sliceTo(ctx);
      if (bars.length < 10) return null;
      const v = vwap(bars);
      if (v == null) return null;
      const prev = bars.at(-2)!;
      const last = bars.at(-1)!;
      if (!(prev.close < v && last.close > v)) return null;
      const levels = longLevels(last.close, Math.min(prev.low, last.low));
      return signal("VWAP_RECLAIM", "LONG", ctx.barIndex, v, levels, "VWAP reclaim close");
    },
  },
  {
    id: "VWAP_REJECTION",
    name: "VWAP Rejection",
    version: "1.0.0",
    family: "vwapRejection",
    side: "SHORT",
    description: "Close back below VWAP after trading above",
    detect: (ctx) => {
      const bars = sliceTo(ctx);
      if (bars.length < 10) return null;
      const v = vwap(bars);
      if (v == null) return null;
      const prev = bars.at(-2)!;
      const last = bars.at(-1)!;
      if (!(prev.close > v && last.close < v)) return null;
      const levels = shortLevels(last.close, Math.max(prev.high, last.high));
      return signal("VWAP_REJECTION", "SHORT", ctx.barIndex, v, levels, "VWAP rejection close");
    },
  },
  {
    id: "PREMARKET_HIGH_BREAK",
    name: "Premarket High Break",
    version: "1.0.0",
    family: "breakoutRetest",
    side: "LONG",
    description: "Break of early-session high proxy",
    detect: (ctx) => {
      const bars = sliceTo(ctx);
      if (bars.length < 10) return null;
      const pre = bars.slice(0, Math.min(6, bars.length - 2));
      const high = Math.max(...pre.map((b) => b.high));
      const last = bars.at(-1)!;
      if (!(last.close > high)) return null;
      const levels = longLevels(last.close, Math.min(...pre.map((b) => b.low)));
      return signal("PREMARKET_HIGH_BREAK", "LONG", ctx.barIndex, high, levels, "Premarket high break");
    },
  },
  {
    id: "PREMARKET_LOW_BREAK",
    name: "Premarket Low Break",
    version: "1.0.0",
    family: "breakoutRetest",
    side: "SHORT",
    description: "Break of early-session low proxy",
    detect: (ctx) => {
      const bars = sliceTo(ctx);
      if (bars.length < 10) return null;
      const pre = bars.slice(0, Math.min(6, bars.length - 2));
      const low = Math.min(...pre.map((b) => b.low));
      const last = bars.at(-1)!;
      if (!(last.close < low)) return null;
      const levels = shortLevels(last.close, Math.max(...pre.map((b) => b.high)));
      return signal("PREMARKET_LOW_BREAK", "SHORT", ctx.barIndex, low, levels, "Premarket low break");
    },
  },
  {
    id: "PRIOR_DAY_HIGH_BREAK",
    name: "Prior-Day High Break",
    version: "1.0.0",
    family: "breakoutRetest",
    side: "LONG",
    description: "Break of prior session high (first-half bars proxy)",
    detect: (ctx) => {
      const bars = sliceTo(ctx);
      if (bars.length < 20) return null;
      const half = Math.floor(bars.length / 2);
      const priorHigh = Math.max(...bars.slice(0, half).map((b) => b.high));
      const last = bars.at(-1)!;
      if (!(last.close > priorHigh)) return null;
      const levels = longLevels(last.close, bars.at(-2)!.low);
      return signal("PRIOR_DAY_HIGH_BREAK", "LONG", ctx.barIndex, priorHigh, levels, "Prior-day high break");
    },
  },
  {
    id: "PRIOR_DAY_LOW_BREAK",
    name: "Prior-Day Low Break",
    version: "1.0.0",
    family: "breakoutRetest",
    side: "SHORT",
    description: "Break of prior session low (first-half bars proxy)",
    detect: (ctx) => {
      const bars = sliceTo(ctx);
      if (bars.length < 20) return null;
      const half = Math.floor(bars.length / 2);
      const priorLow = Math.min(...bars.slice(0, half).map((b) => b.low));
      const last = bars.at(-1)!;
      if (!(last.close < priorLow)) return null;
      const levels = shortLevels(last.close, bars.at(-2)!.high);
      return signal("PRIOR_DAY_LOW_BREAK", "SHORT", ctx.barIndex, priorLow, levels, "Prior-day low break");
    },
  },
  {
    id: "MOMENTUM_CONTINUATION_LONG",
    name: "Momentum Continuation",
    version: "1.0.0",
    family: "momentumContinuation",
    side: "LONG",
    description: "Higher high + higher low continuation",
    detect: (ctx) => {
      const bars = sliceTo(ctx);
      if (bars.length < 5) return null;
      const a = bars.at(-3)!;
      const b = bars.at(-2)!;
      const c = bars.at(-1)!;
      if (!(c.high > b.high && b.high > a.high && c.low > a.low && c.close > b.close)) return null;
      const levels = longLevels(c.close, a.low);
      return signal("MOMENTUM_CONTINUATION_LONG", "LONG", ctx.barIndex, b.high, levels, "Momentum continuation");
    },
  },
  {
    id: "RS_CONTINUATION_LONG",
    name: "Relative Strength Continuation",
    version: "1.0.0",
    family: "momentumContinuation",
    side: "LONG",
    description: "Strong close stretch continuation (RS proxy without benchmark)",
    detect: (ctx) => {
      const bars = sliceTo(ctx);
      if (bars.length < 8) return null;
      const last = bars.at(-1)!;
      const avg = bars.slice(-8, -1).reduce((s, b) => s + b.close, 0) / 7;
      if (!(last.close > avg * 1.004 && last.close > last.open)) return null;
      const levels = longLevels(last.close, Math.min(...bars.slice(-4).map((b) => b.low)));
      return signal("RS_CONTINUATION_LONG", "LONG", ctx.barIndex, avg, levels, "RS continuation proxy");
    },
  },
  {
    id: "RW_CONTINUATION_SHORT",
    name: "Relative Weakness Continuation",
    version: "1.0.0",
    family: "momentumContinuation",
    side: "SHORT",
    description: "Weak close stretch continuation",
    detect: (ctx) => {
      const bars = sliceTo(ctx);
      if (bars.length < 8) return null;
      const last = bars.at(-1)!;
      const avg = bars.slice(-8, -1).reduce((s, b) => s + b.close, 0) / 7;
      if (!(last.close < avg * 0.996 && last.close < last.open)) return null;
      const levels = shortLevels(last.close, Math.max(...bars.slice(-4).map((b) => b.high)));
      return signal("RW_CONTINUATION_SHORT", "SHORT", ctx.barIndex, avg, levels, "RW continuation proxy");
    },
  },
  {
    id: "FAILED_BREAKOUT_REVERSAL",
    name: "Failed Breakout Reversal",
    version: "1.0.0",
    family: "failedBreakoutReversal",
    side: "SHORT",
    description: "Break above swing high then close back below",
    detect: (ctx) => {
      const bars = sliceTo(ctx);
      if (bars.length < 12) return null;
      const level = Math.max(...bars.slice(0, -2).map((b) => b.high));
      const prev = bars.at(-2)!;
      const last = bars.at(-1)!;
      if (!(prev.high > level && last.close < level)) return null;
      const levels = shortLevels(last.close, prev.high);
      return signal("FAILED_BREAKOUT_REVERSAL", "SHORT", ctx.barIndex, level, levels, "Failed breakout reversal");
    },
  },
  {
    id: "FAILED_BREAKDOWN_REVERSAL",
    name: "Failed Breakdown Reversal",
    version: "1.0.0",
    family: "failedBreakoutReversal",
    side: "LONG",
    description: "Break below swing low then close back above",
    detect: (ctx) => {
      const bars = sliceTo(ctx);
      if (bars.length < 12) return null;
      const level = Math.min(...bars.slice(0, -2).map((b) => b.low));
      const prev = bars.at(-2)!;
      const last = bars.at(-1)!;
      if (!(prev.low < level && last.close > level)) return null;
      const levels = longLevels(last.close, prev.low);
      return signal("FAILED_BREAKDOWN_REVERSAL", "LONG", ctx.barIndex, level, levels, "Failed breakdown reversal");
    },
  },
  {
    id: "RSI_EXHAUSTION_LONG",
    name: "RSI Exhaustion + Confirmation",
    version: "1.0.0",
    family: "meanReversion",
    side: "LONG",
    description: "RSI oversold then reclaim confirmation",
    detect: (ctx) => {
      const bars = sliceTo(ctx);
      const closes = bars.map((b) => b.close);
      const r = rsi(closes, 14);
      if (r == null || r > 35) return null;
      const last = bars.at(-1)!;
      const prev = bars.at(-2)!;
      if (!(last.close > prev.close && last.close > last.open)) return null;
      const levels = longLevels(last.close, Math.min(last.low, prev.low));
      return signal("RSI_EXHAUSTION_LONG", "LONG", ctx.barIndex, last.close, levels, `RSI ${r.toFixed(1)} exhaustion long`);
    },
  },
  {
    id: "BOLLINGER_RECOVERY_LONG",
    name: "Bollinger Recovery",
    version: "1.0.0",
    family: "meanReversion",
    side: "LONG",
    description: "Close back inside lower band after pierce",
    detect: (ctx) => {
      const bars = sliceTo(ctx);
      const closes = bars.map((b) => b.close);
      const bb = bollinger(closes, 20, 2);
      if (!bb) return null;
      const prev = bars.at(-2)!;
      const last = bars.at(-1)!;
      if (!(prev.close < bb.lower && last.close > bb.lower && last.close < bb.mid)) return null;
      const levels = longLevels(last.close, prev.low);
      return signal("BOLLINGER_RECOVERY_LONG", "LONG", ctx.barIndex, bb.lower, levels, "Bollinger recovery");
    },
  },
  {
    id: "MACD_MOMENTUM_LONG",
    name: "MACD Momentum",
    version: "1.0.0",
    family: "momentumContinuation",
    side: "LONG",
    description: "MACD histogram turns positive with rising close",
    detect: (ctx) => {
      const bars = sliceTo(ctx);
      const closes = bars.map((b) => b.close);
      if (closes.length < 40) return null;
      const histNow = macdHistogram(closes);
      const histPrev = macdHistogram(closes.slice(0, -1));
      if (histNow == null || histPrev == null) return null;
      const last = bars.at(-1)!;
      if (!(histPrev <= 0 && histNow > 0 && last.close > closes.at(-2)!)) return null;
      const levels = longLevels(last.close, Math.min(...bars.slice(-5).map((b) => b.low)));
      return signal("MACD_MOMENTUM_LONG", "LONG", ctx.barIndex, last.close, levels, "MACD histogram flip up");
    },
  },
];
