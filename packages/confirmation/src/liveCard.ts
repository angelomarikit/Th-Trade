import type {
  ConditionMatrix,
  SetupScore,
  SetupState,
  TradeSide,
} from "@wulu/domain";
import type { WhyMovingBlock } from "@wulu/news";
import type { NearActiveView } from "./nearActive.js";

export interface RegimeCardInfo {
  primary: string;
  bias: string;
  reasons: string[];
  strategyGates: Record<string, boolean>;
}

/** Mobile-fast live card DTO. */
export interface LiveSetupCard {
  symbol: string;
  side: TradeSide;
  state: SetupState;
  statusLabel: string;
  whyMoving: WhyMovingBlock;
  conditionsPassed: number;
  conditionsTotal: number;
  matrix: ConditionMatrix;
  nearActive: NearActiveView;
  alertAt: number;
  entryZone: { low: number; high: number; executable: boolean };
  stop: number;
  target1: number;
  target2: number;
  setupScore: SetupScore;
  lastPrice: number;
  rewardToRisk: number;
  dataFresh: boolean;
  evaluatedAt: string;
  session: {
    session: string;
    etLabel: string;
    tightenConfirmation: boolean;
    reason: string;
  } | null;
  regime: RegimeCardInfo | null;
  /** Phase D — collapsed historical edge; never win probability */
  historicalEdge: HistoricalEdgeCardInfo | null;
  matchedStrategies: MatchedStrategyInfo[];
  /** Phase F — only populated when FEATURE_OPTIONS_ENGINE=true and ENTRY ACTIVE */
  options: OptionsCardInfo | null;
  /** Relative strength / momentum vs SPY, QQQ, sector — context only, not entry permission */
  relativeMomentum: RelativeMomentumCardInfo | null;
}

export interface RelativeMomentumCardInfo {
  feed: string;
  feedLimitation: string;
  symbolIntradayPct: number | null;
  spyIntradayPct: number | null;
  qqqIntradayPct: number | null;
  sectorEtf: string;
  sectorIntradayPct: number | null;
  vsSpyPct: number | null;
  vsQqqPct: number | null;
  vsSectorPct: number | null;
  gapPct: number | null;
  rvol: number | null;
  vwapLocation: "ABOVE" | "BELOW" | "AT" | "UNKNOWN";
  intradayTrend: "BULLISH" | "BEARISH" | "RANGE";
  rankScore: number;
  notes: string[];
}

export interface OptionsCardInfo {
  enabled: boolean;
  eligible: boolean;
  reason: string;
  direction: "CALL" | "PUT" | null;
  bestContract: {
    right: string;
    strike: number;
    expiration: string;
    dte: number;
    delta: number | null;
    bid: number;
    ask: number;
    spread: number;
    spreadPct: number;
    volume: number;
    openInterest: number;
  } | null;
  whyThisContract: string[];
  automaticOrders: false;
}


export interface HistoricalEdgeCardInfo {
  strategyId: string;
  strategyName: string;
  sampleSize: number;
  winRatePct: number | null;
  averageWinnerR: number | null;
  averageLoserR: number | null;
  expectancyR: number | null;
  profitFactor: number | null;
  maxDrawdownR: number | null;
  bestRegime: string | null;
  disclaimer: string;
  collapsedSummary: string;
}

export interface MatchedStrategyInfo {
  strategyId: string;
  strategyName: string;
  family: string;
  reason: string;
}

