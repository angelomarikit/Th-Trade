import type { ConfirmationConfig } from "@wulu/domain";
import type { Bar } from "@wulu/market-data";
import { relativeVolumeLastBar } from "../bars.js";
import type { TechniqueCheck } from "../types.js";
import {
  combineExtensionAndRr,
  extensionGate,
  fiveMinCloseBeyond,
  htfRowPair,
  relativeVolumeGate,
  riskRewardGate,
} from "./primitives.js";

/** Liquidity sweep + reversal: rejection close, sweep-bar volume spike; no HTF/RSI/VWAP gates. */
export function buildLiquiditySweepConfirmations(input: {
  side: "LONG" | "SHORT";
  bars5m: Bar[];
  lastPrice: number;
  level: number;
  config: ConfirmationConfig;
  entryForRr: number;
  stop: number;
  target1: number;
  structure: TechniqueCheck;
  htf1h: "BULLISH" | "BEARISH" | "RANGE" | "UNKNOWN";
  htf15m: "BULLISH" | "BEARISH" | "RANGE" | "UNKNOWN";
  native1h: boolean;
  native15m: boolean;
}): TechniqueCheck[] {
  const ctx = "Liquidity sweep";
  const sweepRvol = relativeVolumeLastBar(input.bars5m);
  return [
    ...htfRowPair({
      htf1h: input.htf1h,
      htf15m: input.htf15m,
      side: input.side,
      context: ctx,
      native1h: input.native1h,
      native15m: input.native15m,
    }),
    fiveMinCloseBeyond(input.bars5m, input.side, input.level, input.config, `${ctx} rejection`),
    relativeVolumeGate(input.bars5m, input.config, {
      breakRatio: sweepRvol,
      minRatio: Math.max(input.config.minRelativeVolume, 1.1),
      context: `${ctx} stop-run bar`,
    }),
    input.structure,
    combineExtensionAndRr(
      extensionGate(
        input.lastPrice,
        input.level,
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
