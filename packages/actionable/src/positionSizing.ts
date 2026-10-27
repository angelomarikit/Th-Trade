import type { PaperPositionSize } from "./types.js";
import {
  MIN_REWARD_TO_RISK,
  PAPER_MAX_ALLOCATION_PER_STOCK,
  PAPER_MAX_PORTFOLIO_RISK,
  PAPER_MAX_POSITIONS,
  PAPER_RISK_PER_TRADE,
} from "./types.js";

export function paperPositionSize(input: {
  equity: number;
  buyingPower: number;
  entry: number;
  stop: number;
  openPositionCount: number;
  openPortfolioRiskPct: number;
  rewardToRisk: number | null;
}): PaperPositionSize {
  if (input.rewardToRisk != null && input.rewardToRisk < MIN_REWARD_TO_RISK) {
    return {
      calculated: false,
      shares: null,
      riskAmount: null,
      message: "Position rejected — reward/risk below 2R minimum.",
    };
  }
  if (input.openPositionCount >= PAPER_MAX_POSITIONS) {
    return {
      calculated: false,
      shares: null,
      riskAmount: null,
      message: "RISK_BLOCKED — max concurrent paper positions (3).",
    };
  }
  if (input.openPortfolioRiskPct >= PAPER_MAX_PORTFOLIO_RISK) {
    return {
      calculated: false,
      shares: null,
      riskAmount: null,
      message: "RISK_BLOCKED — portfolio open risk at 2% cap.",
    };
  }
  const perShareRisk = input.entry - input.stop;
  if (!Number.isFinite(perShareRisk) || perShareRisk <= 0) {
    return {
      calculated: false,
      shares: null,
      riskAmount: null,
      message: "Invalid stop — per-share risk must be positive for long entry.",
    };
  }
  const riskBudget = input.equity * PAPER_RISK_PER_TRADE;
  const riskSized = Math.floor(riskBudget / perShareRisk);
  const cashSized = Math.floor(input.buyingPower / input.entry);
  const allocSized = Math.floor((input.equity * PAPER_MAX_ALLOCATION_PER_STOCK) / input.entry);
  const shares = Math.min(riskSized, cashSized, allocSized);
  if (shares <= 0) {
    return {
      calculated: false,
      shares: 0,
      riskAmount: null,
      message: "Zero-sized quantity after risk, cash, and allocation caps.",
    };
  }
  return {
    calculated: true,
    shares,
    riskAmount: shares * perShareRisk,
    message: null,
  };
}
