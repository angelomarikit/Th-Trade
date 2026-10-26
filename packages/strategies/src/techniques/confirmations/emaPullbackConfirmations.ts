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
  rsiMomentumGate,
  vwapSideGate,
} from "./primitives.js";

/** EMA 9/20 pullback: continuation close at EMA9, RSI required, VWAP soft. */
export function buildEmaPullbackConfirmations(input: {
  side: "LONG" | "SHORT";
  bars5m: Bar[];
  bars1m: Bar[];
  lastPrice: number;
  ema9: number;
  config: ConfirmationConfig;
  htf1h: "BULLISH" | "BEARISH" | "RANGE" | "UNKNOWN";
  htf15m: "BULLISH" | "BEARISH" | "RANGE" | "UNKNOWN";
  native1h: boolean;
  native15m: boolean;
  closes: number[];
  entryForRr: number;
  stop: number;
  target1: number;
  structure: TechniqueCheck;
}): TechniqueCheck[] {
  const ctx = "EMA 9/20 pullback";
  return [
    ...htfRowPair({
      htf1h: input.htf1h,
      htf15m: input.htf15m,
      side: input.side,
      context: ctx,
      native1h: input.native1h,
      native15m: input.native15m,
    }),
    fiveMinCloseBeyond(input.bars5m, input.side, input.ema9, input.config, ctx),
    relativeVolumeGate(input.bars5m, input.config, {
      context: `${ctx} continuation bar`,
    }),
    rsiMomentumGate(input.closes, input.side, input.config, {
      context: ctx,
      required: true,
    }),
    input.structure,
    vwapSideGate(input.bars1m, input.bars5m, input.lastPrice, input.side, {
      context: ctx,
      required: false,
    }),
    combineExtensionAndRr(
      extensionGate(
        input.lastPrice,
        input.ema9,
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
