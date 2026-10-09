import type { TradeSide } from "@wulu/domain";
import type { Bar } from "@wulu/market-data";
import { lastCompletedBar } from "@wulu/market-data";

export interface FiveMinConfirmationResult {
  pass: boolean;
  waiting: boolean;
  trigger: number;
  completedClose: number | null;
  reason: string;
}

/**
 * Completed 5-minute confirmation candle is required.
 * A price touching the trigger is NOT confirmation.
 */
export function evaluateFiveMinConfirmation(
  bars5m: Bar[],
  side: TradeSide,
  trigger: number,
): FiveMinConfirmationResult {
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
        ? `Waiting for completed 5-minute close ${side === "LONG" ? ">" : "<"} ${trigger.toFixed(2)} (trigger touched on forming bar — not an entry)`
        : `Waiting for completed 5-minute close ${side === "LONG" ? ">" : "<"} ${trigger.toFixed(2)}`,
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
    };
  }

  const ok =
    side === "LONG" ? last.close > trigger : last.close < trigger;

  if (ok) {
    return {
      pass: true,
      waiting: false,
      trigger,
      completedClose: last.close,
      reason: `5m confirmation PASS: close ${last.close.toFixed(2)} ${side === "LONG" ? ">" : "<"} trigger ${trigger.toFixed(2)}`,
    };
  }

  return {
    pass: false,
    waiting: true,
    trigger,
    completedClose: last.close,
    reason: `Waiting for completed 5-minute close ${side === "LONG" ? ">" : "<"} ${trigger.toFixed(2)} (last close ${last.close.toFixed(2)})`,
  };
}
