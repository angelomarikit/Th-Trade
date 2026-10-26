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
  vwapSideGate,
} from "./primitives.js";

/** Opening range breakout: OR edge close, elevated RVOL, VWAP side, no RSI gate. */
export function buildOrbConfirmations(input: {
  side: "LONG" | "SHORT";
  bars5m: Bar[];
  bars1m: Bar[];
  lastPrice: number;
  trigger: number;
  orbMinutes: number;
  config: ConfirmationConfig;
  htf1h: "BULLISH" | "BEARISH" | "RANGE" | "UNKNOWN";
  htf15m: "BULLISH" | "BEARISH" | "RANGE" | "UNKNOWN";
  native1h: boolean;
  native15m: boolean;
  entryForRr: number;
  stop: number;
  target1: number;
  structure: TechniqueCheck;
}): TechniqueCheck[] {
  const ctx = `ORB ${input.orbMinutes}m`;
  return [
    ...htfRowPair({
      htf1h: input.htf1h,
      htf15m: input.htf15m,
      side: input.side,
      context: ctx,
      native1h: input.native1h,
      native15m: input.native15m,
    }),
    fiveMinCloseBeyond(input.bars5m, input.side, input.trigger, input.config, ctx),
    relativeVolumeGate(input.bars5m, input.config, {
      minRatio: Math.max(input.config.minRelativeVolume, 1.05),
      context: `${ctx} break volume`,
    }),
    input.structure,
    vwapSideGate(input.bars1m, input.bars5m, input.lastPrice, input.side, {
      context: ctx,
      required: true,
    }),
    combineExtensionAndRr(
      extensionGate(
        input.lastPrice,
        input.trigger,
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
