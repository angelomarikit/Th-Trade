import type { TradeLevels, TradeSide } from "@wulu/domain";
import type { MarketSnapshot } from "@wulu/market-data";
import { ema, rsi } from "@wulu/strategies";
import { evaluateFiveMinConfirmation } from "./fiveMinConfirmation.js";
import { evaluateStructure } from "./structure.js";
import { evaluateVolumeConfirmation } from "./volume.js";
import { evaluateVwap } from "./vwap.js";

export type IndicatorBias = "BULLISH" | "BEARISH" | "NEUTRAL" | "NOT VERIFIED";

export interface IndicatorReading {
  id: string;
  label: string;
  bias: IndicatorBias;
  explanation: string;
  /** Gate alignment for the monitored direction (PASS / WAITING / FAIL). */
  gateStatus: "PASS" | "WAITING" | "FAIL" | "N_A";
}

export function buildIndicatorChecklist(input: {
  side: TradeSide;
  snapshot: MarketSnapshot;
  levels: TradeLevels;
  dataFresh: boolean;
  minRvol?: number;
}): IndicatorReading[] {
  if (!input.dataFresh) {
    return baseLabels().map((row) => ({
      ...row,
      bias: "NOT VERIFIED",
      explanation: "Market data is not verified for this session — no directional read.",
      gateStatus: "N_A",
    }));
  }

  const bars5m = input.snapshot.bars5m;
  const bars1m = input.snapshot.bars1m;
  const priceBars = bars5m.length >= 20 ? bars5m : bars1m;
  const completed = priceBars.filter((b) => b != null && b.completed);
  const closes = completed.map((b) => b.close);
  const lastPrice = input.snapshot.lastPrice;
  const side = input.side;
  const minRvol = input.minRvol ?? 1.2;

  const rsiVal = closes.length >= 15 ? rsi(closes, 14) : null;
  const ema9Series = closes.length >= 9 ? ema(closes, 9) : [];
  const ema9 = ema9Series.length ? ema9Series[ema9Series.length - 1]! : null;

  const vwapRes = evaluateVwap(
    bars1m.length ? bars1m : bars5m,
    lastPrice,
    side,
  );
  const volRes = evaluateVolumeConfirmation(bars5m, minRvol);
  const structRes = evaluateStructure(bars5m, side);
  const fiveRes = evaluateFiveMinConfirmation(bars5m, side, input.levels.trigger);

  return [
    rsiReading(rsiVal, side),
    ema9Reading(ema9, lastPrice, side),
    vwapReading(vwapRes, side),
    rvolReading(volRes, side),
    structureReading(structRes, side),
    fiveMinReading(fiveRes, side),
  ];
}

function baseLabels(): Array<{ id: string; label: string }> {
  return [
    { id: "RSI", label: "RSI (14)" },
    { id: "EMA9", label: "9 EMA trend" },
    { id: "VWAP", label: "VWAP" },
    { id: "RVOL", label: "Volume / RVOL" },
    { id: "STRUCTURE", label: "Market structure" },
    { id: "FIVE_MIN", label: "5-minute confirmation" },
  ];
}

function rsiReading(value: number | null, side: TradeSide): IndicatorReading {
  if (value == null) {
    return {
      id: "RSI",
      label: "RSI (14)",
      bias: "NOT VERIFIED",
      explanation: "Not enough completed bars for RSI.",
      gateStatus: "N_A",
    };
  }
  if (side === "LONG") {
    if (value <= 35) {
      return {
        id: "RSI",
        label: "RSI (14)",
        bias: "BULLISH",
        explanation: `RSI ${value.toFixed(1)} — oversold zone; potential long reclaim if price confirms.`,
        gateStatus: "WAITING",
      };
    }
    if (value >= 70) {
      return {
        id: "RSI",
        label: "RSI (14)",
        bias: "BEARISH",
        explanation: `RSI ${value.toFixed(1)} — overbought; long entry needs caution or reset.`,
        gateStatus: "WAITING",
      };
    }
    return {
      id: "RSI",
      label: "RSI (14)",
      bias: "NEUTRAL",
      explanation: `RSI ${value.toFixed(1)} — mid-range; not extreme.`,
      gateStatus: "WAITING",
    };
  }
  if (value >= 65) {
    return {
      id: "RSI",
      label: "RSI (14)",
      bias: "BEARISH",
      explanation: `RSI ${value.toFixed(1)} — overbought; supports short bias if price rolls over.`,
      gateStatus: "WAITING",
    };
  }
  if (value <= 30) {
    return {
      id: "RSI",
      label: "RSI (14)",
      bias: "BULLISH",
      explanation: `RSI ${value.toFixed(1)} — oversold; short needs breakdown confirmation.`,
      gateStatus: "WAITING",
    };
  }
  return {
    id: "RSI",
    label: "RSI (14)",
    bias: "NEUTRAL",
    explanation: `RSI ${value.toFixed(1)} — mid-range.`,
    gateStatus: "WAITING",
  };
}

function ema9Reading(ema9: number | null, lastPrice: number, side: TradeSide): IndicatorReading {
  if (ema9 == null || !Number.isFinite(ema9)) {
    return {
      id: "EMA9",
      label: "9 EMA trend",
      bias: "NOT VERIFIED",
      explanation: "Not enough completed bars for 9 EMA.",
      gateStatus: "N_A",
    };
  }
  const above = lastPrice >= ema9 * 0.999;
  if (side === "LONG") {
    return above
      ? {
          id: "EMA9",
          label: "9 EMA trend",
          bias: "BULLISH",
          explanation: `Price ${lastPrice.toFixed(2)} at/above 9 EMA ${ema9.toFixed(2)} — short-term trend up.`,
          gateStatus: "PASS",
        }
      : {
          id: "EMA9",
          label: "9 EMA trend",
          bias: "BEARISH",
          explanation: `Price ${lastPrice.toFixed(2)} below 9 EMA ${ema9.toFixed(2)} — short-term trend down vs long.`,
          gateStatus: "WAITING",
        };
  }
  return !above
    ? {
        id: "EMA9",
        label: "9 EMA trend",
        bias: "BEARISH",
        explanation: `Price ${lastPrice.toFixed(2)} at/below 9 EMA ${ema9.toFixed(2)} — short-term trend down.`,
        gateStatus: "PASS",
      }
    : {
        id: "EMA9",
        label: "9 EMA trend",
        bias: "BULLISH",
        explanation: `Price ${lastPrice.toFixed(2)} above 9 EMA ${ema9.toFixed(2)} — short-term trend up vs short.`,
        gateStatus: "WAITING",
      };
}

function vwapReading(res: ReturnType<typeof evaluateVwap>, side: TradeSide): IndicatorReading {
  const gate = res.pass ? "PASS" : res.waiting ? "WAITING" : "FAIL";
  if (side === "LONG") {
    const bias: IndicatorBias = res.pass ? "BULLISH" : res.waiting ? "NEUTRAL" : "BEARISH";
    return {
      id: "VWAP",
      label: "VWAP",
      bias: res.vwap == null ? "NOT VERIFIED" : bias,
      explanation: res.reason,
      gateStatus: gate,
    };
  }
  const bias: IndicatorBias = res.pass ? "BEARISH" : res.waiting ? "NEUTRAL" : "BULLISH";
  return {
    id: "VWAP",
    label: "VWAP",
    bias: res.vwap == null ? "NOT VERIFIED" : bias,
    explanation: res.reason,
    gateStatus: gate,
  };
}

function rvolReading(res: ReturnType<typeof evaluateVolumeConfirmation>, side: TradeSide): IndicatorReading {
  const gate = res.pass ? "PASS" : res.waiting ? "WAITING" : "FAIL";
  const r = res.relativeVolume;
  if (r == null) {
    return {
      id: "RVOL",
      label: "Volume / RVOL",
      bias: "NOT VERIFIED",
      explanation: res.reason,
      gateStatus: gate,
    };
  }
  const strong = r >= 1.2;
  const weak = r < 0.85;
  let bias: IndicatorBias = "NEUTRAL";
  if (side === "LONG") {
    if (strong) bias = "BULLISH";
    else if (weak) bias = "BEARISH";
  } else {
    if (strong) bias = "BEARISH";
    else if (weak) bias = "BULLISH";
  }
  return {
    id: "RVOL",
    label: "Volume / RVOL",
    bias,
    explanation: res.reason,
    gateStatus: gate,
  };
}

function structureReading(res: ReturnType<typeof evaluateStructure>, side: TradeSide): IndicatorReading {
  const gate = res.pass ? "PASS" : res.waiting ? "WAITING" : "FAIL";
  let bias: IndicatorBias = "NEUTRAL";
  if (res.pass) bias = side === "LONG" ? "BULLISH" : "BEARISH";
  else if (!res.waiting && !res.pass) bias = side === "LONG" ? "BEARISH" : "BULLISH";
  return {
    id: "STRUCTURE",
    label: "Market structure",
    bias,
    explanation: res.reason,
    gateStatus: gate,
  };
}

function fiveMinReading(res: ReturnType<typeof evaluateFiveMinConfirmation>, side: TradeSide): IndicatorReading {
  const gate = res.pass ? "PASS" : res.waiting ? "WAITING" : "FAIL";
  let bias: IndicatorBias = "NEUTRAL";
  if (res.pass) bias = side === "LONG" ? "BULLISH" : "BEARISH";
  else if (!res.waiting && !res.pass) bias = side === "LONG" ? "BEARISH" : "BULLISH";
  return {
    id: "FIVE_MIN",
    label: "5-minute confirmation",
    bias,
    explanation: res.reason,
    gateStatus: gate,
  };
}
