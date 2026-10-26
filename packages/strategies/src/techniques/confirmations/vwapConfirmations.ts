import type { ConfirmationConfig } from "@wulu/domain";
import type { Bar } from "@wulu/market-data";
import type { TechniqueCheck } from "../types.js";
import {
  combineExtensionAndRr,
  extensionGate,
  fiveMinCloseBeyond,
  htfRowPair,
  relativeVolumeGate,
  riskRewardGate,
} from "./primitives.js";

/** VWAP reclaim/rejection: cross + hold on VWAP; lighter volume bar; no duplicate generic VWAP row. */
export function buildVwapConfirmations(input: {
  side: "LONG" | "SHORT";
  bars5m: Bar[];
  lastPrice: number;
  vwap: number;
  config: ConfirmationConfig;
  htf1h: "BULLISH" | "BEARISH" | "RANGE" | "UNKNOWN";
  htf15m: "BULLISH" | "BEARISH" | "RANGE" | "UNKNOWN";
  native1h: boolean;
  native15m: boolean;
  entryForRr: number;
  stop: number;
  target1: number;
  structure: TechniqueCheck;
  vwapHold: TechniqueCheck;
}): TechniqueCheck[] {
  const ctx = input.side === "LONG" ? "VWAP Reclaim" : "VWAP Rejection";
  return [
    ...htfRowPair({
      htf1h: input.htf1h,
      htf15m: input.htf15m,
      side: input.side,
      context: ctx,
      native1h: input.native1h,
      native15m: input.native15m,
    }),
    fiveMinCloseBeyond(input.bars5m, input.side, input.vwap, input.config, ctx),
    relativeVolumeGate(input.bars5m, input.config, {
      minRatio: Math.max(0.75, input.config.minRelativeVolume * 0.85),
      context: `${ctx} participation`,
    }),
    input.structure,
    input.vwapHold,
    combineExtensionAndRr(
      extensionGate(
        input.lastPrice,
        input.vwap,
        input.bars5m,
        input.side,
        input.config,
        ctx,
      ),
      riskRewardGate(
        input.entryForRr,
        input.stop,
        input.target1,
        input.config,
        ctx,
      ),
    ),
  ];
}
