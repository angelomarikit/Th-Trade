import type { TradeSide } from "@wulu/domain";
import type { Bar } from "@wulu/market-data";
import { sessionVwap } from "@wulu/market-data";

export interface VwapResult {
  pass: boolean;
  waiting: boolean;
  vwap: number | null;
  reason: string;
}

export function evaluateVwap(
  bars: Bar[],
  lastPrice: number,
  side: TradeSide,
): VwapResult {
  const vwap = sessionVwap(bars);
  if (vwap == null) {
    return {
      pass: false,
      waiting: true,
      vwap: null,
      reason: "Waiting for VWAP (insufficient volume)",
    };
  }

  if (side === "LONG") {
    if (lastPrice >= vwap) {
      return {
        pass: true,
        waiting: false,
        vwap,
        reason: `VWAP PASS: price ${lastPrice.toFixed(2)} >= VWAP ${vwap.toFixed(2)}`,
      };
    }
    return {
      pass: false,
      waiting: true,
      vwap,
      reason: `Waiting for VWAP reclaim (price ${lastPrice.toFixed(2)} < VWAP ${vwap.toFixed(2)})`,
    };
  }

  if (lastPrice <= vwap) {
    return {
      pass: true,
      waiting: false,
      vwap,
      reason: `VWAP PASS: price ${lastPrice.toFixed(2)} <= VWAP ${vwap.toFixed(2)}`,
    };
  }
  return {
    pass: false,
    waiting: true,
    vwap,
    reason: `Waiting for VWAP rejection (price ${lastPrice.toFixed(2)} > VWAP ${vwap.toFixed(2)})`,
  };
}
