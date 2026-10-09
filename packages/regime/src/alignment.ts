import type { TradeSide } from "@wulu/domain";
import type { ConditionStatus } from "@wulu/domain";
import type { Bar, MarketSnapshot } from "@wulu/market-data";
import type { RegimeSnapshot } from "./labels.js";
import { relativeStrengthRatio } from "./technicals.js";

export interface AlignmentResult {
  status: ConditionStatus;
  pass: boolean;
  reason: string;
}

/**
 * Soft gate: regime alignment for the proposed trade side.
 * Conflicting regimes FAIL; mixed/range WAIT; aligned PASS.
 * Not required for ENTRY ACTIVE (confirmation still authoritative).
 */
export function evaluateRegimeAlignment(
  regime: RegimeSnapshot,
  side: TradeSide,
): AlignmentResult {
  if (side === "LONG") {
    if (regime.trend === "BEARISH" || regime.riskTone === "RISK_OFF") {
      return {
        status: "FAIL",
        pass: false,
        reason: `Market regime conflicting for LONG (${regime.primary})`,
      };
    }
    if (regime.trend === "BULLISH" || regime.riskTone === "RISK_ON") {
      return {
        status: "PASS",
        pass: true,
        reason: `Market regime aligned for LONG (${regime.primary})`,
      };
    }
    return {
      status: "WAITING",
      pass: false,
      reason: `Market regime mixed/range (${regime.primary}) — caution for LONG`,
    };
  }

  if (regime.trend === "BULLISH" || regime.riskTone === "RISK_ON") {
    return {
      status: "FAIL",
      pass: false,
      reason: `Market regime conflicting for SHORT (${regime.primary})`,
    };
  }
  if (regime.trend === "BEARISH" || regime.riskTone === "RISK_OFF") {
    return {
      status: "PASS",
      pass: true,
      reason: `Market regime aligned for SHORT (${regime.primary})`,
    };
  }
  return {
    status: "WAITING",
    pass: false,
    reason: `Market regime mixed/range (${regime.primary}) — caution for SHORT`,
  };
}

export function evaluateSectorAlignment(input: {
  side: TradeSide;
  symbolSnapshot: MarketSnapshot;
  sectorSnapshot: MarketSnapshot | null;
  spySnapshot: MarketSnapshot;
}): AlignmentResult {
  if (!input.sectorSnapshot) {
    return {
      status: "WAITING",
      pass: false,
      reason: "Sector ETF data unavailable — WAITING",
    };
  }

  const symbolBars = prefer(input.symbolSnapshot);
  const sectorBars = prefer(input.sectorSnapshot);
  const spyBars = prefer(input.spySnapshot);

  const vsSpy = relativeStrengthRatio(symbolBars, spyBars, 10);
  const sectorVsSpy = relativeStrengthRatio(sectorBars, spyBars, 10);

  if (vsSpy == null || sectorVsSpy == null) {
    return {
      status: "WAITING",
      pass: false,
      reason: "Waiting for enough completed bars for sector alignment",
    };
  }

  if (input.side === "LONG") {
    if (vsSpy >= 0 && sectorVsSpy >= -0.1) {
      return {
        status: "PASS",
        pass: true,
        reason: `Sector alignment PASS for LONG (symbol RS ${fmt(vsSpy)}, sector RS ${fmt(sectorVsSpy)})`,
      };
    }
    if (vsSpy < -0.25 && sectorVsSpy < -0.15) {
      return {
        status: "FAIL",
        pass: false,
        reason: `Sector alignment conflicting for LONG (symbol RS ${fmt(vsSpy)}, sector RS ${fmt(sectorVsSpy)})`,
      };
    }
    return {
      status: "WAITING",
      pass: false,
      reason: `Sector alignment mixed for LONG (symbol RS ${fmt(vsSpy)}, sector RS ${fmt(sectorVsSpy)})`,
    };
  }

  if (vsSpy <= 0 && sectorVsSpy <= 0.1) {
    return {
      status: "PASS",
      pass: true,
      reason: `Sector alignment PASS for SHORT (symbol RS ${fmt(vsSpy)}, sector RS ${fmt(sectorVsSpy)})`,
    };
  }
  if (vsSpy > 0.25 && sectorVsSpy > 0.15) {
    return {
      status: "FAIL",
      pass: false,
      reason: `Sector alignment conflicting for SHORT (symbol RS ${fmt(vsSpy)}, sector RS ${fmt(sectorVsSpy)})`,
    };
  }
  return {
    status: "WAITING",
    pass: false,
    reason: `Sector alignment mixed for SHORT (symbol RS ${fmt(vsSpy)}, sector RS ${fmt(sectorVsSpy)})`,
  };
}

function prefer(snapshot: MarketSnapshot): Bar[] {
  return snapshot.bars5m.length >= 20 ? snapshot.bars5m : snapshot.bars1m;
}

function fmt(n: number): string {
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}`;
}
