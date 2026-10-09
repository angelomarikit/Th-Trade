import type { TradeSide } from "@wulu/domain";

export interface BacktestTrade {
  strategyId: string;
  symbol: string;
  side: TradeSide;
  signalBarIndex: number;
  entryBarIndex: number;
  exitBarIndex: number;
  entryPrice: number;
  exitPrice: number;
  stop: number;
  target1: number;
  rMultiple: number;
  outcome: "WIN" | "LOSS" | "TIMEOUT";
  regimePrimary?: string;
  hasCatalyst?: boolean;
  entryHourUtc: number;
  mfeR: number;
  maeR: number;
}

export interface BacktestRunResult {
  strategyId: string;
  symbol: string;
  trades: BacktestTrade[];
  schemaVersion: string;
}
