import type { ConfirmationConfig } from "@wulu/domain";
import type { Bar, MarketSnapshot } from "@wulu/market-data";
import { rsi, vwap } from "../../helpers.js";
import { atrAbs, relativeVolumeLastBar } from "../bars.js";
import type { TechniqueCheck } from "../types.js";
import { lastCompleted } from "../types.js";

/** Completed 5m closes for momentum reads. */
export function closesFrom5m(snapshot: MarketSnapshot): number[] {
  return snapshot.bars5m.filter((b) => b.completed).map((b) => b.close);
}

export function fiveMinCloseBeyond(
  bars5m: Bar[],
  side: "LONG" | "SHORT",
  level: number,
  config: ConfirmationConfig,
  label: string,
): TechniqueCheck {
  const buffer = level * config.fiveMinCloseBufferPct;
  const last = lastCompleted(bars5m);
  const forming = bars5m.at(-1);
  if (!last) {
    return {
      id: "FIVE_MIN_CONFIRMATION",
      status: "WAITING",
      reason: `${label} — waiting for completed 5-minute candle`,
      requiredForEntry: true,
    };
  }
  const ok =
    side === "LONG" ? last.close > level + buffer : last.close < level - buffer;
  if (ok) {
    return {
      id: "FIVE_MIN_CONFIRMATION",
      status: "PASS",
      reason: `${label}: 5m close ${last.close.toFixed(2)} ${side === "LONG" ? "above" : "below"} ${level.toFixed(2)}`,
      requiredForEntry: true,
    };
  }
  const touched =
    forming &&
    !forming.completed &&
    (side === "LONG" ? forming.high >= level : forming.low <= level);
  return {
    id: "FIVE_MIN_CONFIRMATION",
    status: "WAITING",
    reason: touched
      ? `${label} — trigger touched on forming bar; need completed 5m close`
      : `${label} — last close ${last.close.toFixed(2)} vs ${level.toFixed(2)}`,
    requiredForEntry: true,
  };
}

export function relativeVolumeGate(
  bars5m: Bar[],
  config: ConfirmationConfig,
  opts: { minRatio?: number; breakRatio?: number | null; context: string },
): TechniqueCheck {
  const min = opts.minRatio ?? config.minRelativeVolume;
  const rvol = opts.breakRatio ?? relativeVolumeLastBar(bars5m);
  if (rvol == null) {
    return {
      id: "RELATIVE_VOLUME",
      status: "WAITING",
      reason: `${opts.context} — waiting for volume baseline`,
      requiredForEntry: true,
    };
  }
  if (rvol >= min) {
    return {
      id: "RELATIVE_VOLUME",
      status: "PASS",
      reason: `${opts.context}: ${rvol.toFixed(2)}x >= ${min}x`,
      requiredForEntry: true,
    };
  }
  return {
    id: "RELATIVE_VOLUME",
    status: "WAITING",
    reason: `${opts.context}: ${rvol.toFixed(2)}x < ${min}x`,
    requiredForEntry: true,
  };
}

export function rsiMomentumGate(
  closes: number[],
  side: "LONG" | "SHORT",
  config: ConfirmationConfig,
  opts: { context: string; required: boolean },
): TechniqueCheck {
  const val = closes.length >= 15 ? rsi(closes, 14) : null;
  if (val == null) {
    return {
      id: "SECTOR_ALIGNMENT",
      status: "WAITING",
      reason: `${opts.context} — RSI warming up`,
      requiredForEntry: opts.required,
    };
  }
  if (side === "LONG") {
    if (val >= config.rsiBullMin) {
      return {
        id: "SECTOR_ALIGNMENT",
        status: "PASS",
        reason: `${opts.context}: RSI ${val.toFixed(1)} supports LONG momentum`,
        requiredForEntry: opts.required,
      };
    }
    return {
      id: "SECTOR_ALIGNMENT",
      status: opts.required ? "WAITING" : "N_A",
      reason: `${opts.context}: RSI ${val.toFixed(1)} below ${config.rsiBullMin}`,
      requiredForEntry: opts.required,
    };
  }
  if (val <= config.rsiBearMax) {
    return {
      id: "SECTOR_ALIGNMENT",
      status: "PASS",
      reason: `${opts.context}: RSI ${val.toFixed(1)} supports SHORT momentum`,
      requiredForEntry: opts.required,
    };
  }
  return {
    id: "SECTOR_ALIGNMENT",
    status: opts.required ? "WAITING" : "N_A",
    reason: `${opts.context}: RSI ${val.toFixed(1)} above ${config.rsiBearMax}`,
    requiredForEntry: opts.required,
  };
}

export function vwapSideGate(
  bars1m: Bar[],
  bars5m: Bar[],
  lastPrice: number,
  side: "LONG" | "SHORT",
  opts: { context: string; required: boolean },
): TechniqueCheck {
  const bars = bars1m.filter((b) => b.completed).length >= 10 ? bars1m : bars5m;
  const v = vwap(bars.filter((b) => b.completed));
  if (v == null) {
    return {
      id: "VWAP",
      status: "WAITING",
      reason: `${opts.context} — VWAP not ready`,
      requiredForEntry: opts.required,
    };
  }
  if (side === "LONG" && lastPrice >= v) {
    return {
      id: "VWAP",
      status: "PASS",
      reason: `${opts.context}: ${lastPrice.toFixed(2)} >= VWAP ${v.toFixed(2)}`,
      requiredForEntry: opts.required,
    };
  }
  if (side === "SHORT" && lastPrice <= v) {
    return {
      id: "VWAP",
      status: "PASS",
      reason: `${opts.context}: ${lastPrice.toFixed(2)} <= VWAP ${v.toFixed(2)}`,
      requiredForEntry: opts.required,
    };
  }
  return {
    id: "VWAP",
    status: opts.required ? "WAITING" : "N_A",
    reason:
      side === "LONG"
        ? `${opts.context}: need price >= VWAP ${v.toFixed(2)}`
        : `${opts.context}: need price <= VWAP ${v.toFixed(2)}`,
    requiredForEntry: opts.required,
  };
}

type HtfBias = "BULLISH" | "BEARISH" | "RANGE" | "UNKNOWN";

function htfSideAligned(bias: HtfBias, side: "LONG" | "SHORT"): boolean {
  if (bias === "UNKNOWN" || bias === "RANGE") return true;
  if (side === "LONG" && bias === "BEARISH") return false;
  if (side === "SHORT" && bias === "BULLISH") return false;
  return true;
}

export function htf1hGate(input: {
  bias: HtfBias;
  side: "LONG" | "SHORT";
  context: string;
  native: boolean;
}): TechniqueCheck {
  const src = input.native ? "native 1h bars" : "5m aggregate proxy";
  if (input.bias === "UNKNOWN") {
    return {
      id: "HTF_1H",
      status: "WAITING",
      reason: `${input.context} — 1h trend not ready (${src})`,
      requiredForEntry: false,
    };
  }
  if (!htfSideAligned(input.bias, input.side)) {
    return {
      id: "HTF_1H",
      status: "WAITING",
      reason: `${input.context} — 1h ${input.bias} conflicts with ${input.side} (${src})`,
      requiredForEntry: false,
    };
  }
  return {
    id: "HTF_1H",
    status: "PASS",
    reason: `${input.context} — 1h ${input.bias} (${src})`,
    requiredForEntry: false,
  };
}

export function htf15mGate(input: {
  bias: HtfBias;
  side: "LONG" | "SHORT";
  context: string;
  native: boolean;
}): TechniqueCheck {
  const src = input.native ? "native 15m bars" : "5m-derived proxy";
  if (input.bias === "UNKNOWN") {
    return {
      id: "HTF_15M",
      status: "WAITING",
      reason: `${input.context} — 15m trend not ready (${src})`,
      requiredForEntry: false,
    };
  }
  if (!htfSideAligned(input.bias, input.side)) {
    return {
      id: "HTF_15M",
      status: "WAITING",
      reason: `${input.context} — 15m ${input.bias} conflicts with ${input.side} (${src})`,
      requiredForEntry: false,
    };
  }
  return {
    id: "HTF_15M",
    status: "PASS",
    reason: `${input.context} — 15m ${input.bias} (${src})`,
    requiredForEntry: false,
  };
}

export function htfRowPair(input: {
  htf1h: HtfBias;
  htf15m: HtfBias;
  side: "LONG" | "SHORT";
  context: string;
  native1h: boolean;
  native15m: boolean;
}): TechniqueCheck[] {
  return [
    htf1hGate({
      bias: input.htf1h,
      side: input.side,
      context: input.context,
      native: input.native1h,
    }),
    htf15mGate({
      bias: input.htf15m,
      side: input.side,
      context: input.context,
      native: input.native15m,
    }),
  ];
}

export function extensionGate(
  lastPrice: number,
  anchor: number,
  bars5m: Bar[],
  side: "LONG" | "SHORT",
  config: ConfirmationConfig,
  context: string,
): TechniqueCheck {
  const atr = atrAbs(bars5m);
  if (atr == null) {
    return {
      id: "RISK_REWARD",
      status: "WAITING",
      reason: `${context} — ATR extension check pending`,
      requiredForEntry: true,
    };
  }
  const maxChase =
    side === "LONG"
      ? anchor + atr * config.atrExtensionMultiple
      : anchor - atr * config.atrExtensionMultiple;
  const extended = side === "LONG" ? lastPrice > maxChase : lastPrice < maxChase;
  if (extended) {
    return {
      id: "RISK_REWARD",
      status: "FAIL",
      reason: `${context} — extended ${config.atrExtensionMultiple}× ATR; do not chase`,
      requiredForEntry: true,
    };
  }
  return {
    id: "RISK_REWARD",
    status: "PASS",
    reason: `${context} — not over-extended from anchor`,
    requiredForEntry: true,
  };
}

export function riskRewardGate(
  entry: number,
  stop: number,
  target1: number,
  config: ConfirmationConfig,
  context: string,
): TechniqueCheck {
  const risk = Math.abs(entry - stop);
  const reward = Math.abs(target1 - entry);
  const rr = risk > 0 ? reward / risk : 0;
  if (rr >= config.minRewardToRisk) {
    return {
      id: "RISK_REWARD",
      status: "PASS",
      reason: `${context}: ${rr.toFixed(2)}R >= ${config.minRewardToRisk}R`,
      requiredForEntry: true,
    };
  }
  return {
    id: "RISK_REWARD",
    status: "WAITING",
    reason: `${context}: ${rr.toFixed(2)}R < ${config.minRewardToRisk}R at conservative entry`,
    requiredForEntry: true,
  };
}

/** Extension FAIL wins; else R:R row. */
export function combineExtensionAndRr(
  extension: TechniqueCheck,
  rr: TechniqueCheck,
): TechniqueCheck {
  if (extension.status === "FAIL") return extension;
  return rr;
}
