import type { Bar } from "@wulu/market-data";
import type { FinalAction, StrategyEvaluation, StrategyKey } from "../types.js";
import { MIN_REWARD_TO_RISK } from "../types.js";
import {
  adx,
  atrAbs,
  avgVolume,
  completed,
  closes,
  emaAt,
  lastEma,
  rising,
  rsi,
} from "../indicators.js";

function rr(entry: number, stop: number, target: number): number | null {
  const risk = entry - stop;
  const reward = target - entry;
  if (risk <= 0 || reward <= 0) return null;
  return reward / risk;
}

function base(
  strategy: StrategyKey,
  partial: Partial<StrategyEvaluation> & Pick<StrategyEvaluation, "action" | "reason">,
): StrategyEvaluation {
  return {
    strategy,
    confirmationsPassed: [],
    conditionsMissing: [],
    entryCondition: null,
    proposedEntry: null,
    entryRange: null,
    stopLoss: null,
    takeProfit: null,
    rewardToRisk: null,
    waitTrigger: null,
    expiresAt: null,
    eligibleInRegime: true,
    score: 0,
    ...partial,
  };
}

export function evaluateEmaPullbackDaily(stockDaily: Bar[]): StrategyEvaluation {
  const strategy: StrategyKey = "EMA_PULLBACK_DAILY";
  const c = completed(stockDaily);
  const missing: string[] = [];
  const passed: string[] = [];
  if (c.length < 210) {
    return base(strategy, {
      action: "DATA_UNAVAILABLE",
      reason: "Need 200+ daily bars for EMA stack",
      conditionsMissing: ["daily_history"],
    });
  }
  const cl = closes(c);
  const lastBar = c[c.length - 1]!;
  const prevBar = c[c.length - 2]!;
  const last = cl[cl.length - 1]!;
  const ema200 = lastEma(cl, 200)!;
  const ema50 = lastEma(cl, 50)!;
  const ema20 = lastEma(cl, 20)!;
  const atr = atrAbs(c, 14)!;

  if (last <= ema200) missing.push("close_above_ema200");
  else passed.push("close_above_ema200");
  if (!(ema20 > ema50 && ema50 > ema200)) missing.push("ema20_50_200_stack");
  else passed.push("ema20_50_200_stack");

  const ema20Series = cl.map((_, i) => emaAt(cl, 20, i)).filter((v): v is number => v != null);
  if (!rising(ema20Series, 5)) missing.push("ema20_rising_5");
  else passed.push("ema20_rising_5");

  const prior5 = c.slice(-6, -1);
  const nearEma20 = prior5.every((b) => Math.abs(b.close - ema20) <= 0.5 * atr);
  if (!nearEma20) missing.push("pullback_within_0.5_atr_of_ema20");
  else passed.push("pullback_within_0.5_atr_of_ema20");

  if (prior5.some((b) => b.close < ema50)) missing.push("pullback_held_ema50");
  else passed.push("pullback_held_ema50");

  const confirm = lastBar.close > prevBar.high;
  if (!confirm) missing.push("bullish_confirmation_close_above_prev_high");

  const entry = lastBar.close;
  const pullbackLow = Math.min(...prior5.map((b) => b.low));
  const stop = pullbackLow - 0.25 * atr;
  const target = entry + 2 * (entry - stop);
  const ext = entry - lastBar.close;
  if (ext > 0.5 * atr) missing.push("entry_extension");

  let action: FinalAction = "SKIP";
  let reason = "Trend or pullback structure invalid";
  if (missing.length === 0 || (missing.length === 1 && missing[0] === "bullish_confirmation_close_above_prev_high")) {
    if (!confirm) {
      action = "WAIT_FOR_TRIGGER";
      reason = "Pullback qualifies — wait for close above prior high";
      return base(strategy, {
        action,
        reason,
        confirmationsPassed: passed,
        conditionsMissing: missing,
        waitTrigger: "Daily close above previous candle high",
        entryCondition: "Limit near confirmation close after trigger",
      });
    }
    const r = rr(entry, stop, target);
    if (r == null || r < MIN_REWARD_TO_RISK) {
      return base(strategy, {
        action: "SKIP",
        reason: "Insufficient 2R after stop placement",
        confirmationsPassed: passed,
        conditionsMissing: ["min_2r"],
        proposedEntry: entry,
        stopLoss: stop,
        takeProfit: target,
        rewardToRisk: r,
      });
    }
    return base(strategy, {
      action: "BUY_CANDIDATE",
      reason: "Daily EMA pullback confirmed with 2R+ target",
      confirmationsPassed: [...passed, "bullish_confirmation_close_above_prev_high"],
      conditionsMissing: [],
      entryCondition: "Regular-session limit near confirmation close",
      proposedEntry: entry,
      entryRange: { low: entry - 0.1 * atr, high: entry + 0.5 * atr },
      stopLoss: stop,
      takeProfit: target,
      rewardToRisk: r,
      score: 70 + Math.min(20, r * 5),
    });
  }
  return base(strategy, {
    action,
    reason,
    confirmationsPassed: passed,
    conditionsMissing: missing,
  });
}

export function evaluateBreakoutDaily(
  stockDaily: Bar[],
  volumeComparable: boolean,
): StrategyEvaluation {
  const strategy: StrategyKey = "BREAKOUT_DAILY";
  if (!volumeComparable) {
    return base(strategy, {
      action: "SKIP",
      reason: "Breakout disabled — volume feed not comparable to consolidated baseline",
      conditionsMissing: ["comparable_volume_feed"],
      eligibleInRegime: true,
    });
  }
  const c = completed(stockDaily);
  if (c.length < 22) {
    return base(strategy, {
      action: "DATA_UNAVAILABLE",
      reason: "Need 20+ prior daily bars",
      conditionsMissing: ["daily_history"],
    });
  }
  const signal = c[c.length - 1]!;
  const prior = c.slice(-21, -1);
  const resistance = Math.max(...prior.map((b) => b.high));
  const atr = atrAbs(c, 14);
  if (atr == null) {
    return base(strategy, { action: "DATA_UNAVAILABLE", reason: "ATR unavailable", conditionsMissing: ["atr"] });
  }
  const avgVol = avgVolume(c, 20, 1);
  const breakClose = signal.close > resistance + 0.1 * atr;
  const volOk = avgVol != null && signal.volume >= 1.5 * avgVol;
  const closePos =
    signal.high > signal.low &&
    (signal.close - signal.low) / (signal.high - signal.low) >= 0.75;
  const dist = signal.close - resistance;
  const near = dist >= -0.5 * atr && dist < 0.1 * atr;

  if (!breakClose && near) {
    return base(strategy, {
      action: "WAIT_FOR_TRIGGER",
      reason: "Within 0.5 ATR below resistance — wait for breakout close",
      waitTrigger: `Daily close above ${resistance.toFixed(2)} + 0.1 ATR`,
      confirmationsPassed: ["near_resistance"],
      conditionsMissing: ["breakout_close"],
    });
  }
  if (!breakClose || !volOk || !closePos) {
    return base(strategy, {
      action: "SKIP",
      reason: "No valid breakout participation or candle quality",
      conditionsMissing: [
        !breakClose ? "breakout_close" : "",
        !volOk ? "volume_1.5x" : "",
        !closePos ? "close_upper_quartile" : "",
      ].filter(Boolean),
    });
  }
  const entry = signal.close;
  const stop = Math.min(resistance - 0.25 * atr, signal.low - 0.1 * atr);
  const target = entry + 2 * (entry - stop);
  const r = rr(entry, stop, target);
  if (r == null || r < MIN_REWARD_TO_RISK) {
    return base(strategy, {
      action: "SKIP",
      reason: "Breakout extension or stop/target fail 2R",
      proposedEntry: entry,
      stopLoss: stop,
      rewardToRisk: r,
    });
  }
  return base(strategy, {
    action: "BUY_CANDIDATE",
    reason: "Daily breakout with volume and 2R target",
    confirmationsPassed: ["breakout_close", "volume_1.5x", "close_upper_quartile"],
    conditionsMissing: [],
    proposedEntry: entry,
    entryRange: { low: resistance, high: entry + 0.5 * atr },
    stopLoss: stop,
    takeProfit: target,
    rewardToRisk: r,
    score: 65 + Math.min(25, r * 5),
  });
}

export function evaluateRsiMeanReversion(stockDaily: Bar[]): StrategyEvaluation {
  const strategy: StrategyKey = "RSI_MEAN_REVERSION_DAILY";
  const c = completed(stockDaily);
  if (c.length < 45) {
    return base(strategy, {
      action: "DATA_UNAVAILABLE",
      reason: "Insufficient daily history for RSI/support",
      conditionsMissing: ["daily_history"],
    });
  }
  const cl = closes(c);
  const adx14 = adx(c, 14);
  if (adx14 == null || adx14 >= 20) {
    return base(strategy, {
      action: "SKIP",
      reason: "ADX>=20 — not range-bound",
      conditionsMissing: ["adx_below_20"],
    });
  }
  const rsiSeries = rsi(cl, 14);
  const lastRsi = rsiSeries[rsiSeries.length - 1];
  const hadOversold = rsiSeries.slice(-6, -1).some((v) => v != null && v < 30);
  const cross35 = lastRsi != null && lastRsi > 35 && (rsiSeries[rsiSeries.length - 2] ?? 0) <= 35;
  const last = c[c.length - 1]!;
  const prev = c[c.length - 2]!;
  const confirm = last.close > prev.high;
  const window = c.slice(-40);
  const lows = window.map((b) => b.low);
  const support = Math.min(...lows.slice(0, -5));
  const atr = atrAbs(c, 14) ?? 0;
  if (last.close < support - 0.25 * atr) {
    return base(strategy, {
      action: "SKIP",
      reason: "Decisive breakdown below structural support",
      conditionsMissing: ["support_hold"],
    });
  }
  if (!hadOversold && last.low > support + 0.5 * atr) {
    return base(strategy, {
      action: "WAIT_FOR_TRIGGER",
      reason: "Range context — wait for RSI recovery and confirmation",
      waitTrigger: "RSI cross above 35 with bullish confirmation candle",
      conditionsMissing: ["rsi_recovery"],
    });
  }
  if (!hadOversold || !cross35 || !confirm) {
    return base(strategy, {
      action: "SKIP",
      reason: "RSI mean-reversion trigger incomplete",
      conditionsMissing: [
        !hadOversold ? "rsi_was_oversold" : "",
        !cross35 ? "rsi_cross_35" : "",
        !confirm ? "confirmation_candle" : "",
      ].filter(Boolean),
    });
  }
  const entry = last.close;
  const stop = support - 0.25 * atr;
  const mid = (support + Math.max(...window.map((b) => b.high))) / 2;
  const target = mid;
  const r = rr(entry, stop, target);
  if (r == null || r < MIN_REWARD_TO_RISK) {
    return base(strategy, {
      action: "SKIP",
      reason: "Range target does not achieve 2R",
      rewardToRisk: r,
    });
  }
  return base(strategy, {
    action: "BUY_CANDIDATE",
    reason: "RSI recovery at support with 2R to range midpoint",
    confirmationsPassed: ["adx_below_20", "rsi_recovery", "confirmation_candle"],
    conditionsMissing: [],
    proposedEntry: entry,
    stopLoss: stop,
    takeProfit: target,
    rewardToRisk: r,
    score: 60 + Math.min(20, r * 4),
  });
}

/** Intraday VWAP reclaim — requires 5m RTH bars. */
export function evaluateVwapIntraday(
  bars5m: Bar[] | undefined,
  spreadPct: number | null | undefined,
  volumeComparable: boolean,
): StrategyEvaluation {
  const strategy: StrategyKey = "VWAP_RECLAIM_INTRADAY";
  if (!bars5m?.length) {
    return base(strategy, {
      action: "DATA_UNAVAILABLE",
      reason: "Missing 5-minute intraday bars",
      conditionsMissing: ["bars5m"],
    });
  }
  if (!volumeComparable) {
    return base(strategy, {
      action: "SKIP",
      reason: "Intraday volume comparison invalid on current feed",
      conditionsMissing: ["comparable_intraday_volume"],
    });
  }
  if (spreadPct != null && spreadPct > 0.2) {
    return base(strategy, {
      action: "SKIP",
      reason: "Spread too wide for intraday entry",
      conditionsMissing: ["spread_ok"],
    });
  }
  const c = completed(bars5m);
  if (c.length < 12) {
    return base(strategy, {
      action: "DATA_UNAVAILABLE",
      reason: "Insufficient 5m history",
      conditionsMissing: ["bars5m_count"],
    });
  }
  let cumPv = 0;
  let cumV = 0;
  const vwapAt: number[] = [];
  for (const b of c) {
    cumPv += ((b.high + b.low + b.close) / 3) * b.volume;
    cumV += b.volume;
    vwapAt.push(cumV > 0 ? cumPv / cumV : b.close);
  }
  const last = c[c.length - 1]!;
  const prev = c[c.length - 2]!;
  const vwap = vwapAt[vwapAt.length - 1]!;
  const wasBelow = c.slice(-4, -1).some((b, i) => b.close < vwapAt[vwapAt.length - 4 + i]!);
  const reclaim = last.close > vwap && last.close > prev.high;
  const atr = atrAbs(c, 14) ?? 0;
  if (!wasBelow) {
    return base(strategy, {
      action: "WAIT_FOR_TRIGGER",
      reason: "Wait for dip below VWAP then reclaim",
      waitTrigger: "5m close above VWAP after prior below-VWAP bars",
    });
  }
  if (!reclaim) {
    return base(strategy, {
      action: "WAIT_FOR_TRIGGER",
      reason: "VWAP reclaim not confirmed on latest 5m close",
      waitTrigger: "Close above VWAP and previous bar high",
      confirmationsPassed: ["was_below_vwap"],
      conditionsMissing: ["vwap_reclaim"],
    });
  }
  const swingLow = Math.min(...c.slice(-5).map((b) => b.low));
  const entry = last.close;
  const stop = swingLow;
  const target = entry + 2 * (entry - stop);
  const r = rr(entry, stop, target);
  if (entry - last.close > 0.5 * atr) {
    return base(strategy, { action: "SKIP", reason: "Overextended from trigger", conditionsMissing: ["extension"] });
  }
  if (r == null || r < MIN_REWARD_TO_RISK) {
    return base(strategy, { action: "SKIP", reason: "Intraday 2R not feasible", rewardToRisk: r });
  }
  return base(strategy, {
    action: "BUY_CANDIDATE",
    reason: "Confirmed VWAP reclaim with 2R intraday target",
    confirmationsPassed: ["vwap_reclaim", "confirmation_candle"],
    conditionsMissing: [],
    proposedEntry: entry,
    stopLoss: stop,
    takeProfit: target,
    rewardToRisk: r,
    score: 68,
  });
}

export function evaluateMtfTrend(
  stockDaily: Bar[],
  bars15m: Bar[] | undefined,
): StrategyEvaluation {
  const strategy: StrategyKey = "MTF_TREND";
  const c = completed(stockDaily);
  if (c.length < 210 || !bars15m?.length) {
    return base(strategy, {
      action: "DATA_UNAVAILABLE",
      reason: "Need daily EMA200 stack and 15m bars",
      conditionsMissing: ["daily_or_15m"],
    });
  }
  const cl = closes(c);
  const last = cl[cl.length - 1]!;
  const ema200 = lastEma(cl, 200)!;
  const ema50 = lastEma(cl, 50)!;
  const ema20 = lastEma(cl, 20)!;
  const rsiSeries = rsi(cl, 14);
  const dRsi = rsiSeries[rsiSeries.length - 1];
  if (last <= ema200 || !(ema20 > ema50)) {
    return base(strategy, {
      action: "SKIP",
      reason: "Daily trend invalid for MTF long",
      conditionsMissing: ["daily_trend"],
    });
  }
  if (dRsi == null || dRsi < 45 || dRsi > 70) {
    return base(strategy, {
      action: "SKIP",
      reason: "Daily RSI outside 45–70 band",
      conditionsMissing: ["daily_rsi_band"],
    });
  }
  const m15 = completed(bars15m);
  const cl15 = closes(m15);
  const ema20_15 = lastEma(cl15, 20);
  if (ema20_15 == null) {
    return base(strategy, { action: "DATA_UNAVAILABLE", reason: "15m EMA unavailable", conditionsMissing: [] });
  }
  const lastBar = m15[m15.length - 1]!;
  const prevBar = m15[m15.length - 2]!;
  const touched = m15.slice(-4, -1).some((b) => b.low <= ema20_15 || b.close <= ema20_15);
  const confirm = lastBar.close > ema20_15 && lastBar.close > prevBar.high;
  if (touched && !confirm) {
    return base(strategy, {
      action: "WAIT_FOR_TRIGGER",
      reason: "Daily trend OK — wait for 15m confirmation",
      waitTrigger: "15m close above EMA20 and prior high",
      confirmationsPassed: ["daily_trend", "15m_touch_ema20"],
      conditionsMissing: ["15m_confirmation"],
    });
  }
  if (!confirm) {
    return base(strategy, {
      action: "SKIP",
      reason: "No 15m pullback trigger",
      conditionsMissing: ["15m_setup"],
    });
  }
  const entry = lastBar.close;
  const stop = Math.min(...m15.slice(-6).map((b) => b.low)) - 0.1 * (atrAbs(m15, 14) ?? 0);
  const target = entry + 2 * (entry - stop);
  const r = rr(entry, stop, target);
  if (r == null || r < MIN_REWARD_TO_RISK) {
    return base(strategy, { action: "SKIP", reason: "MTF 2R failed", rewardToRisk: r });
  }
  return base(strategy, {
    action: "BUY_CANDIDATE",
    reason: "Daily trend + 15m confirmation",
    confirmationsPassed: ["daily_trend", "15m_confirmation"],
    conditionsMissing: [],
    proposedEntry: entry,
    stopLoss: stop,
    takeProfit: target,
    rewardToRisk: r,
    score: 72,
  });
}

export function evaluateOpeningRange(
  bars5m: Bar[] | undefined,
  enabled: boolean,
  volumeComparable: boolean,
): StrategyEvaluation {
  const strategy: StrategyKey = "OPENING_RANGE_BREAKOUT";
  if (!enabled) {
    return base(strategy, {
      action: "SKIP",
      reason: "Opening-range breakout disabled by default until feed/backtest validation",
      conditionsMissing: ["strategy_disabled"],
      eligibleInRegime: false,
    });
  }
  if (!volumeComparable || !bars5m?.length) {
    return base(strategy, {
      action: "DATA_UNAVAILABLE",
      reason: "ORB requires comparable intraday feed",
      conditionsMissing: ["feed"],
    });
  }
  return base(strategy, {
    action: "WAIT_FOR_TRIGGER",
    reason: "ORB enabled — awaiting validated opening-range completion logic in production feed",
    waitTrigger: "09:30–10:00 ET range then 5m close above OR high",
  });
}

export function evaluateAllStrategies(input: {
  stockDaily: Bar[];
  bars5m?: Bar[];
  bars15m?: Bar[];
  volumeFeedComparable: boolean;
  spreadPct?: number | null;
  orbEnabled?: boolean;
}): StrategyEvaluation[] {
  return [
    evaluateEmaPullbackDaily(input.stockDaily),
    evaluateBreakoutDaily(input.stockDaily, input.volumeFeedComparable),
    evaluateRsiMeanReversion(input.stockDaily),
    evaluateVwapIntraday(input.bars5m, input.spreadPct, input.volumeFeedComparable),
    evaluateMtfTrend(input.stockDaily, input.bars15m),
    evaluateOpeningRange(input.bars5m, input.orbEnabled === true, input.volumeFeedComparable),
  ];
}
