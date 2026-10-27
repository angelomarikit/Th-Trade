import type { Bar } from "@wulu/market-data";

/** Spec §11 universal actions (advisory / paper only). */
export type FinalAction =
  | "BUY_CANDIDATE"
  | "WAIT_FOR_TRIGGER"
  | "SKIP"
  | "DATA_UNAVAILABLE"
  | "RISK_BLOCKED"
  | "HOLD_POSITION"
  | "EXIT_CANDIDATE"
  | "REDUCE_POSITION_CANDIDATE";

export type MarketRegimeLabel =
  | "BULLISH"
  | "SIDEWAYS"
  | "BEARISH"
  | "HIGH_VOLATILITY"
  | "UNCERTAIN"
  | "DATA_UNAVAILABLE";

export type StrategyKey =
  | "EMA_PULLBACK_DAILY"
  | "BREAKOUT_DAILY"
  | "RSI_MEAN_REVERSION_DAILY"
  | "VWAP_RECLAIM_INTRADAY"
  | "MTF_TREND"
  | "OPENING_RANGE_BREAKOUT";

export interface StrategyEvaluation {
  strategy: StrategyKey;
  action: FinalAction;
  confirmationsPassed: string[];
  conditionsMissing: string[];
  reason: string;
  entryCondition: string | null;
  proposedEntry: number | null;
  entryRange: { low: number; high: number } | null;
  stopLoss: number | null;
  takeProfit: number | null;
  rewardToRisk: number | null;
  waitTrigger: string | null;
  expiresAt: string | null;
  eligibleInRegime: boolean;
  score: number;
}

export interface PaperPositionSize {
  calculated: boolean;
  shares: number | null;
  riskAmount: number | null;
  message: string | null;
}

export interface SetupWatchView {
  symbol: string;
  strategy: StrategyKey | null;
  status: FinalAction;
  reason: string;
  nextAction: string;
  invalidation: string;
  expiresRule: string;
}

export interface StockDecisionOutput {
  symbol: string;
  marketRegime: MarketRegimeLabel;
  currentPrice: number;
  evaluatedAt: string;
  dataFeed: string;
  volumeFeedComparable: boolean;
  strategiesEvaluated: StrategyEvaluation[];
  primaryStrategy: StrategyKey | null;
  finalAction: FinalAction;
  entryCondition: string | null;
  proposedEntry: number | null;
  entryRange: { low: number; high: number } | null;
  stopLoss: number | null;
  takeProfit: number | null;
  estimatedRewardToRisk: number | null;
  riskAmount: number | null;
  suggestedPaperSize: PaperPositionSize;
  confirmationsPassed: string[];
  conditionsMissing: string[];
  decisionReason: string;
  nextReevaluationTrigger: string | null;
  signalExpiration: string | null;
  executionEligible: boolean;
  setupWatch: SetupWatchView | null;
  advisoryOnly: true;
}

export interface AnalyzeStockInput {
  symbol: string;
  now?: Date;
  dataFeed: string;
  lastPrice: number;
  /** Completed daily bars, oldest → newest */
  stockDaily: Bar[];
  spyDaily: Bar[];
  bars5m?: Bar[];
  bars15m?: Bar[];
  /** False when IEX volume cannot be compared to consolidated baseline */
  volumeFeedComparable: boolean;
  spreadPct?: number | null;
  openingRangeBreakoutEnabled?: boolean;
  paperAccount?: {
    equity: number;
    buyingPower: number;
    openPositionCount: number;
    openPortfolioRiskPct: number;
    hasOpenPositionInSymbol: boolean;
    hasPendingOrderInSymbol: boolean;
  };
}

export const PAPER_RISK_PER_TRADE = 0.005;
export const PAPER_MAX_POSITIONS = 3;
export const PAPER_MAX_PORTFOLIO_RISK = 0.02;
export const PAPER_MAX_ALLOCATION_PER_STOCK = 0.2;
export const MIN_REWARD_TO_RISK = 2;
