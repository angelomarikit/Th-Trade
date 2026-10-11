import type { TradeSide } from "@wulu/domain";
import type { Bar } from "@wulu/market-data";
import { lastCompletedBar } from "@wulu/market-data";
import { candleAnatomy } from "./candleAnatomy.js";

export interface FiveMinConfirmationResult {
  pass: boolean;
  waiting: boolean;
  trigger: number;
  completedClose: number | null;
  reason: string;
  bodyRatio: number | null;
  upperWickRatio: number | null;
  lowerWickRatio: number | null;
}

/**
 * Completed 5-minute confirmation candle is required.
 * A price touching the trigger is NOT confirmation.
 * Requires close beyond trigger by a small buffer and hold into the close.
 */
export function evaluateFiveMinConfirmation(
  bars5m: Bar[],
  side: TradeSide,
  trigger: number,
  bufferPct = 0.0005,
): FiveMinConfirmationResult {
  const buffer = trigger * bufferPct;
  const forming = bars5m.at(-1);
  if (forming && !forming.completed) {
    const touch =
      side === "LONG" ? forming.high >= trigger : forming.low <= trigger;
    return {
      pass: false,
      waiting: true,
      trigger,
      completedClose: null,
      reason: touch
        ? `Waiting for completed 5-minute close ${side === "LONG" ? ">" : "<"} ${(trigger + (side === "LONG" ? buffer : -buffer)).toFixed(2)} (trigger touched on forming bar — not an entry)`
        : `Waiting for completed 5-minute close ${side === "LONG" ? ">" : "<"} ${trigger.toFixed(2)}`,
      bodyRatio: null,
      upperWickRatio: null,
      lowerWickRatio: null,
    };
  }

  const last = lastCompletedBar(bars5m);
  if (!last) {
    return {
      pass: false,
      waiting: true,
      trigger,
      completedClose: null,
      reason: "Waiting for completed 5-minute close",
      bodyRatio: null,
      upperWickRatio: null,
      lowerWickRatio: null,
    };
  }

  const anat = candleAnatomy(last);
  const closedBackInside =
    side === "LONG"
      ? last.high > trigger && last.close < trigger
      : last.low < trigger && last.close > trigger;

  if (closedBackInside) {
    return {
      pass: false,
      waiting: false,
      trigger,
      completedClose: last.close,
      reason: `5m confirmation FAIL: pierced level but closed back inside (close ${last.close.toFixed(2)})`,
      bodyRatio: anat.bodyRatio,
      upperWickRatio: anat.upperWickRatio,
      lowerWickRatio: anat.lowerWickRatio,
    };
  }

  const ok =
    side === "LONG"
      ? last.close > trigger + buffer
      : last.close < trigger - buffer;

  if (ok) {
    return {
      pass: true,
      waiting: false,
      trigger,
      completedClose: last.close,
      reason: `5m confirmation PASS: close ${last.close.toFixed(2)} ${side === "LONG" ? ">" : "<"} trigger±buffer (body ${(anat.bodyRatio * 100).toFixed(0)}%)`,
      bodyRatio: anat.bodyRatio,
      upperWickRatio: anat.upperWickRatio,
      lowerWickRatio: anat.lowerWickRatio,
    };
  }

  return {
    pass: false,
    waiting: true,
    trigger,
    completedClose: last.close,
    reason: `Waiting for completed 5-minute close ${side === "LONG" ? ">" : "<"} ${trigger.toFixed(2)} (last close ${last.close.toFixed(2)})`,
    bodyRatio: anat.bodyRatio,
    upperWickRatio: anat.upperWickRatio,
    lowerWickRatio: anat.lowerWickRatio,
  };
}
