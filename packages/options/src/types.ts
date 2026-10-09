import type { TradeSide } from "@wulu/domain";

export type OptionRight = "CALL" | "PUT";

export interface OptionContract {
  symbol: string;
  underlying: string;
  right: OptionRight;
  strike: number;
  expiration: string; // YYYY-MM-DD
  dte: number;
  delta: number | null;
  bid: number;
  ask: number;
  mid: number;
  spread: number;
  spreadPct: number;
  volume: number;
  openInterest: number;
  premium: number;
  /** Optional underlying sensitivity proxy when delta missing */
  underlyingSensitivity: number | null;
}

export interface OptionsChainQuery {
  underlying: string;
  side: TradeSide;
  /** Prefer this many calendar days */
  targetDte?: number;
  minDte?: number;
  maxDte?: number;
  asOf?: Date;
}

export interface OptionsChainProvider {
  readonly name: string;
  getChain(query: OptionsChainQuery): Promise<OptionContract[]>;
}

export interface ContractRankerConfig {
  maxSpreadPct: number;
  minVolume: number;
  minOpenInterest: number;
  minDte: number;
  maxDte: number;
  /** Preferred absolute delta band center (e.g. 0.40) */
  targetAbsDelta: number;
  minAbsDelta: number;
  maxAbsDelta: number;
}

export const DEFAULT_RANKER_CONFIG: ContractRankerConfig = {
  maxSpreadPct: 12,
  minVolume: 10,
  minOpenInterest: 50,
  minDte: 3,
  maxDte: 45,
  targetAbsDelta: 0.4,
  minAbsDelta: 0.25,
  maxAbsDelta: 0.55,
};

export interface RankedContract {
  contract: OptionContract;
  score: number;
  rejectReasons: string[];
  whyThisContract: string[];
}

export interface OptionsEngineResult {
  enabled: boolean;
  eligible: boolean;
  reason: string;
  underlyingState: string;
  direction: OptionRight | null;
  best: RankedContract | null;
  candidatesConsidered: number;
  rejectedCount: number;
  /** Explicit: never submit orders from this engine */
  automaticOrders: false;
}
