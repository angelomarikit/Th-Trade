export interface SessionInfo {
  session: string;
  etLabel: string;
  tightenConfirmation: boolean;
  reason: string;
}

export interface MatrixRow {
  id: string;
  label: string;
  status: string;
  reason: string;
}

export interface ChartBar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  vwap: number | null;
  completed: boolean;
}

export interface SignalRecommendation {
  action: "BUY" | "SELL" | "WAIT";
  recommendation: string;
  confidence: string;
  reasons: string[];
  blockers: string[];
  brief: string;
  briefSource: "rules" | "model";
  automatic: boolean;
  creditsCharged?: number;
  creditsRemaining?: number | null;
}

export interface SetupResponse {
  signalRecommendation?: SignalRecommendation;
  liveCard: {
    headline: string;
    status: string;
    state?: string;
    whyMoving: string;
    catalyst: string | null;
    newsAgeMinutes: number | null;
    priceReaction: string | null;
    conditions: string;
    conditionsPassed?: number;
    conditionsTotal?: number;
    alertAt: number;
    waitingFor: string[];
    entryZone: { low: number; high: number; executable: boolean };
    stop: number;
    t1: number;
    t2: number;
    lastPrice?: number;
    rewardToRisk?: number;
    dataFresh?: boolean;
    evaluatedAt?: string;
    setupScore: string;
    setupScoreValue?: number;
    setupScoreDisclaimer: string;
    market: string | null;
    marketRegime: string | null;
    session: SessionInfo | null;
    matchedStrategies?: Array<{
      strategyId: string;
      strategyName: string;
      family: string;
      reason: string;
    }>;
    historicalEdge: {
      strategyName: string;
      sampleSize: number;
      winRatePct: number | null;
      expectancyR: number | null;
      averageWinnerR: number | null;
      averageLoserR: number | null;
      disclaimer: string;
      collapsedSummary: string;
    } | null;
    options: {
      enabled: boolean;
      eligible: boolean;
      reason: string;
      bestContract: {
        right: string;
        strike: number;
        expiration: string;
        dte: number;
        delta: number | null;
        bid: number;
        ask: number;
        spreadPct: number;
        volume: number;
        openInterest: number;
      } | null;
      whyThisContract: string[];
    } | null;
    nearActive?: {
      active: boolean;
      trigger: number;
      distanceToTriggerAbs: number;
      distanceToTriggerPct: number;
      distanceLabel: string;
      conditionsPassed: number;
      conditionsTotal: number;
      stillWaitingFor: string[];
      confirmationRequirement: string;
      permissionToEnter: false;
      dataTimestamp: string | null;
      setupQualityScore: number | null;
    };
    relativeMomentum?: {
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
      vwapLocation: string;
      intradayTrend: string;
      rankScore: number;
      notes: string[];
    } | null;
  };
  card: {
    lastPrice: number;
    rewardToRisk: number;
    dataFresh: boolean;
    conditionsPassed: number;
    conditionsTotal: number;
    evaluatedAt: string;
    setupScore: { total: number; disclaimer: string };
    session: SessionInfo | null;
    matrix: { rows: MatrixRow[] };
    matchedStrategies?: Array<{
      strategyId: string;
      strategyName: string;
      family: string;
      reason: string;
    }>;
    historicalEdge: SetupResponse["liveCard"]["historicalEdge"];
    whyMoving: {
      whyMoving: string;
      catalystLabel: string | null;
      newsAgeMinutes: number | null;
      priceReaction: string | null;
      hasVerifiedCatalyst: boolean;
    };
    nearActive: { stillWaitingFor: string[] };
    statusLabel: string;
    state: string;
    alertAt: number;
    entryZone: { low: number; high: number; executable: boolean };
    stop: number;
    target1: number;
    target2: number;
    regime: { primary: string; bias: string; reasons: string[] } | null;
  };
  journalEntryId: string | null;
  positionSizing: {
    calculated: boolean;
    shares: number | null;
    dollarsAtRisk: number | null;
    message: string | null;
  };
  verifiedAccountConfigured?: boolean;
  accountEnvironment: "SIGNALS_ONLY" | "PAPER" | "LIVE";
  safety: {
    triggerIsNotEntry: boolean;
    newsCannotCreateEntryActive: boolean;
    optionsEngine: boolean;
    automaticOrders: boolean;
    executionPlatform?: string;
    alpacaRole?: string;
  };
}

export interface HealthResponse {
  ok: boolean;
  phase: string;
  newsProvider: string;
  marketDataProvider: string;
  alpacaFeed?: string;
  alpacaCredentialsPresent: boolean;
  journalEnabled: boolean;
  journalCount: number;
  optionsEngine: boolean;
  accountEnvironment?: string;
  supabaseConfigured?: boolean;
  openaiConfigured?: boolean;
  execution: {
    automaticOrders: boolean;
    platform: string;
    alpacaRole: string;
  };
}

export interface BarsResponse {
  symbol: string;
  timeframe: string;
  provider: string;
  feed: string;
  count: number;
  bars: ChartBar[];
}

export interface JournalListResponse {
  count: number;
  analytics: unknown;
  entries: Array<{
    id: string;
    decisionAt: string;
    symbol: string;
    side: string;
    state: string;
    strategyId: string | null;
    setupScore: number | null;
    marketRegime: string | null;
    hasCatalyst: boolean;
    outcome: { status: string; rMultiple?: number | null };
  }>;
}

export interface CatalystResponse {
  ticker: string;
  why: {
    whyMoving: string;
    catalystLabel: string | null;
    newsAgeMinutes: number | null;
    priceReaction: string | null;
    hasVerifiedCatalyst: boolean;
  };
  event: {
    eventId: string;
    headline: string;
    category: string;
    originalSource: string;
    originalPublishedAt: string;
    memberCount: number;
    priceReaction: string | null;
    verified: boolean;
  } | null;
}

export interface EdgeResponse {
  panel: {
    strategyName: string;
    sampleSize: number;
    winRatePct: number | null;
    expectancyR: number | null;
    disclaimer: string;
    collapsedSummary?: string;
  };
  text: string;
}

const API_BASE = import.meta.env.VITE_API_BASE ?? "";

async function getJson<T>(path: string, headers?: Record<string, string>): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: headers && Object.keys(headers).length ? headers : undefined,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(body || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export function fetchSetup(
  ticker: string,
  side: "LONG" | "SHORT",
  opts?: { brief?: boolean; accessToken?: string | null },
) {
  const qs = new URLSearchParams({
    ticker,
    side,
  });
  if (opts?.brief) qs.set("brief", "1");
  const headers: Record<string, string> = {};
  if (opts?.accessToken) {
    headers.Authorization = `Bearer ${opts.accessToken}`;
  }
  return getJson<SetupResponse>(`/v1/setup?${qs}`, headers);
}

export function fetchBars(ticker: string, timeframe: string, limit = 150) {
  return getJson<BarsResponse>(
    `/v1/bars?ticker=${encodeURIComponent(ticker)}&timeframe=${encodeURIComponent(timeframe)}&limit=${limit}`,
  );
}

export function fetchHealth() {
  return getJson<HealthResponse>("/health");
}

export function fetchJournal(limit = 50) {
  return getJson<JournalListResponse>(`/v1/journal?limit=${limit}`);
}

export function fetchCatalyst(ticker: string) {
  return getJson<CatalystResponse>(`/v1/catalyst?ticker=${encodeURIComponent(ticker)}`);
}

export function fetchEdge(ticker: string, strategy = "VWAP_RECLAIM") {
  return getJson<EdgeResponse>(
    `/v1/edge?ticker=${encodeURIComponent(ticker)}&strategy=${encodeURIComponent(strategy)}`,
  );
}

export function fetchRegime() {
  return getJson<{
    market: string;
    marketRegime: string;
    reasons: string[];
    strategyGates: Record<string, boolean>;
    generatedAt: string;
  }>("/v1/regime");
}

export function fetchRank(tickers: string[]) {
  const qs = encodeURIComponent(tickers.join(","));
  return getJson<{
    feed: string;
    provider: string;
    disclaimer: string;
    count: number;
    ranked: Array<{
      symbol: string;
      rank: number;
      momentum: {
        vsSpyPct: number | null;
        rankScore: number;
        rvol: number | null;
        vwapLocation: string;
        intradayTrend: string;
        notes: string[];
      };
    }>;
  }>(`/v1/rank?tickers=${qs}`);
}
