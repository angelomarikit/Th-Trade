import type { ConfirmationConfig } from "@wulu/domain";
import type { Bar, MarketSnapshot } from "@wulu/market-data";
import { rsi, vwap } from "../helpers.js";
import { atrAbs, relativeVolumeLastBar } from "./bars.js";
import type { TechniqueCheck } from "./types.js";
import { lastCompleted } from "./types.js";

export function checkFiveMinClose(
  bars5m: Bar[],
  side: "LONG" | "SHORT",
  trigger: number,
  config: ConfirmationConfig,
): TechniqueCheck {
  const buffer = trigger * config.fiveMinCloseBufferPct;
  const last = lastCompleted(bars5m);
  const forming = bars5m.at(-1);
  if (!last) {
    return {
      id: "FIVE_MIN_CONFIRMATION",
      status: "WAITING",
      reason: "Waiting for completed 5-minute candle",
      requiredForEntry: true,
    };
  }
  const ok =
    side === "LONG" ? last.close > trigger + buffer : last.close < trigger - buffer;
  if (ok) {
    return {
      id: "FIVE_MIN_CONFIRMATION",
      status: "PASS",
      reason: `5m close ${last.close.toFixed(2)} confirmed ${side === "LONG" ? "above" : "below"} ${trigger.toFixed(2)}`,
      requiredForEntry: true,
    };
  }
  const touched =
    forming &&
    !forming.completed &&
    (side === "LONG" ? forming.high >= trigger : forming.low <= trigger);
  return {
    id: "FIVE_MIN_CONFIRMATION",
    status: "WAITING",
    reason: touched
      ? `Trigger touched on forming bar — need completed 5m close ${side === "LONG" ? ">" : "<"} ${(trigger + (side === "LONG" ? buffer : -buffer)).toFixed(2)}`
      : `Waiting for completed 5m close ${side === "LONG" ? ">" : "<"} ${trigger.toFixed(2)} (last close ${last.close.toFixed(2)})`,
    requiredForEntry: true,
  };
}

export function checkVolume(bars5m: Bar[], config: ConfirmationConfig, breakRatio?: number | null): TechniqueCheck {
  const rvol = breakRatio ?? relativeVolumeLastBar(bars5m);
  if (rvol == null) {
    return {
      id: "RELATIVE_VOLUME",
      status: "WAITING",
      reason: "Waiting for volume confirmation",
      requiredForEntry: true,
    };
  }
  if (rvol >= config.minRelativeVolume) {
    return {
      id: "RELATIVE_VOLUME",
      status: "PASS",
      reason: `Volume ${rvol.toFixed(2)}x >= ${config.minRelativeVolume}x`,
      requiredForEntry: true,
    };
  }
  return {
    id: "RELATIVE_VOLUME",
    status: "WAITING",
    reason: `Waiting for volume (${rvol.toFixed(2)}x < ${config.minRelativeVolume}x)`,
    requiredForEntry: true,
  };
}

export function checkRsi(closes: number[], side: "LONG" | "SHORT", config: ConfirmationConfig): TechniqueCheck {
  const val = closes.length >= 15 ? rsi(closes, 14) : null;
  if (val == null) {
    return {
      id: "SECTOR_ALIGNMENT",
      status: "WAITING",
      reason: "RSI — insufficient bars",
      requiredForEntry: true,
    };
  }
  if (side === "LONG") {
    if (val >= config.rsiBullMin) {
      return {
        id: "SECTOR_ALIGNMENT",
        status: "PASS",
        reason: `RSI ${val.toFixed(1)} >= ${config.rsiBullMin} (bullish momentum)`,
        requiredForEntry: true,
      };
    }
    return {
      id: "SECTOR_ALIGNMENT",
      status: "WAITING",
      reason: `RSI ${val.toFixed(1)} < ${config.rsiBullMin} — momentum not confirmed for LONG`,
      requiredForEntry: true,
    };
  }
  if (val <= config.rsiBearMax) {
    return {
      id: "SECTOR_ALIGNMENT",
      status: "PASS",
      reason: `RSI ${val.toFixed(1)} <= ${config.rsiBearMax} (bearish momentum)`,
      requiredForEntry: true,
    };
  }
  return {
    id: "SECTOR_ALIGNMENT",
    status: "WAITING",
    reason: `RSI ${val.toFixed(1)} > ${config.rsiBearMax} — momentum not confirmed for SHORT`,
    requiredForEntry: true,
  };
}

export function checkVwapSide(bars1m: Bar[], bars5m: Bar[], lastPrice: number, side: "LONG" | "SHORT"): TechniqueCheck {
  const bars = bars1m.length >= 10 ? bars1m : bars5m;
  const v = vwap(bars.filter((b) => b.completed));
  if (v == null) {
    return {
      id: "VWAP",
      status: "WAITING",
      reason: "Waiting for VWAP",
      requiredForEntry: true,
    };
  }
  if (side === "LONG" && lastPrice >= v) {
    return {
      id: "VWAP",
      status: "PASS",
      reason: `Price ${lastPrice.toFixed(2)} >= VWAP ${v.toFixed(2)}`,
      requiredForEntry: true,
    };
  }
  if (side === "SHORT" && lastPrice <= v) {
    return {
      id: "VWAP",
      status: "PASS",
      reason: `Price ${lastPrice.toFixed(2)} <= VWAP ${v.toFixed(2)}`,
      requiredForEntry: true,
    };
  }
  return {
    id: "VWAP",
    status: "WAITING",
    reason:
      side === "LONG"
        ? `Waiting for VWAP reclaim (${lastPrice.toFixed(2)} < ${v.toFixed(2)})`
        : `Waiting for VWAP rejection (${lastPrice.toFixed(2)} > ${v.toFixed(2)})`,
    requiredForEntry: true,
  };
}

export function checkExtension(
  lastPrice: number,
  trigger: number,
  bars5m: Bar[],
  side: "LONG" | "SHORT",
  config: ConfirmationConfig,
): TechniqueCheck {
  const atr = atrAbs(bars5m);
  if (atr == null) {
    return {
      id: "RISK_REWARD",
      status: "WAITING",
      reason: "Waiting for ATR extension check",
      requiredForEntry: true,
    };
  }
  const maxChase =
    side === "LONG"
      ? trigger + atr * config.atrExtensionMultiple
      : trigger - atr * config.atrExtensionMultiple;
  const extended = side === "LONG" ? lastPrice > maxChase : lastPrice < maxChase;
  if (extended) {
    return {
      id: "RISK_REWARD",
      status: "FAIL",
      reason: `Extended ${config.atrExtensionMultiple}× 5m ATR beyond trigger — do not chase`,
      requiredForEntry: true,
    };
  }
  return {
    id: "RISK_REWARD",
    status: "PASS",
    reason: `Not extended beyond ${config.atrExtensionMultiple}× ATR from trigger`,
    requiredForEntry: true,
  };
}

export function checkRiskReward(
  entry: number,
  stop: number,
  target1: number,
  config: ConfirmationConfig,
): TechniqueCheck {
  const risk = Math.abs(entry - stop);
  const reward = Math.abs(target1 - entry);
  const rr = risk > 0 ? reward / risk : 0;
  if (rr >= config.minRewardToRisk) {
    return {
      id: "RISK_REWARD",
      status: "PASS",
      reason: `R:R ${rr.toFixed(2)} >= ${config.minRewardToRisk}`,
      requiredForEntry: true,
    };
  }
  return {
    id: "RISK_REWARD",
    status: "WAITING",
    reason: `R:R ${rr.toFixed(2)} < ${config.minRewardToRisk} at conservative entry`,
    requiredForEntry: true,
  };
}

export function mergeRrChecks(extension: TechniqueCheck, rr: TechniqueCheck): TechniqueCheck {
  if (extension.status === "FAIL") return extension;
  return rr;
}

export function checkHtfRegime(
  htf: "BULLISH" | "BEARISH" | "RANGE" | "UNKNOWN",
  side: "LONG" | "SHORT",
): TechniqueCheck {
  if (htf === "UNKNOWN") {
    return {
      id: "MARKET_REGIME",
      status: "WAITING",
      reason: "Higher-timeframe trend not yet available",
      requiredForEntry: false,
    };
  }
  if (side === "LONG" && htf === "BEARISH") {
    return {
      id: "MARKET_REGIME",
      status: "WAITING",
      reason: "15m/1h context bearish — caution for LONG breakout",
      requiredForEntry: false,
    };
  }
  if (side === "SHORT" && htf === "BULLISH") {
    return {
      id: "MARKET_REGIME",
      status: "WAITING",
      reason: "15m/1h context bullish — caution for SHORT",
      requiredForEntry: false,
    };
  }
  return {
    id: "MARKET_REGIME",
    status: "PASS",
    reason: `HTF context ${htf} — aligned enough for ${side}`,
    requiredForEntry: false,
  };
}

export function closesFromSnapshot(snapshot: MarketSnapshot): number[] {
  const bars = snapshot.bars5m.filter((b) => b.completed);
  return bars.map((b) => b.close);
}
