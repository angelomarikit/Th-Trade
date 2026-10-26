import type { ConfirmationConfig } from "@wulu/domain";
import type { Bar } from "@wulu/market-data";
import type { TechniqueCheck } from "../types.js";
import {
  closesFrom5m,
  combineExtensionAndRr,
  extensionGate,
  fiveMinCloseBeyond,
  htfRowPair,
  relativeVolumeGate,
  riskRewardGate,
  rsiMomentumGate,
  vwapSideGate,
} from "./primitives.js";

/** Breakout + Retest: break-bar volume, 5m close at swing level, VWAP with trend, optional HTF. */
export function buildBreakoutRetestConfirmations(input: {
  side: "LONG" | "SHORT";
  bars5m: Bar[];
  bars1m: Bar[];
  lastPrice: number;
  level: number;
  config: ConfirmationConfig;
  htf1h: "BULLISH" | "BEARISH" | "RANGE" | "UNKNOWN";
  htf15m: "BULLISH" | "BEARISH" | "RANGE" | "UNKNOWN";
  native1h: boolean;
  native15m: boolean;
  closes: number[];
  breakVol: number | null;
  entryForRr: number;
  stop: number;
  target1: number;
  structure: TechniqueCheck;
}): TechniqueCheck[] {
  const ctx = "Breakout+Retest";
  return [
    ...htfRowPair({
      htf1h: input.htf1h,
      htf15m: input.htf15m,
      side: input.side,
      context: ctx,
      native1h: input.native1h,
      native15m: input.native15m,
    }),
    fiveMinCloseBeyond(input.bars5m, input.side, input.level, input.config, ctx),
    relativeVolumeGate(input.bars5m, input.config, {
      breakRatio: input.breakVol,
      context: `${ctx} break-bar RVOL`,
    }),
    rsiMomentumGate(input.closes, input.side, input.config, {
      context: ctx,
      required: true,
    }),
    input.structure,
    vwapSideGate(input.bars1m, input.bars5m, input.lastPrice, input.side, {
      context: ctx,
      required: true,
    }),
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

export { closesFrom5m };
