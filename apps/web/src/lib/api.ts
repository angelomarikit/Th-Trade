import { API_BASE, apiUrl, friendlyApiError } from "./apiBase";

export { API_BASE, friendlyApiError };

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
    symbol?: string;
    side?: "LONG" | "SHORT";
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
    t3?: number | null;
    lastPrice?: number;
    qualityScore10?: number | null;
    qualityScore10Disclaimer?: string | null;
    matrixChecklist?: Array<{
      id: string;
      label: string;
      status: string;
      requiredForEntry: boolean;
      reason: string;
    }>;
    indicatorChecklist?: Array<{
      id: string;
      label: string;
      bias: "BULLISH" | "BEARISH" | "NEUTRAL" | "NOT VERIFIED";
      explanation: string;
      gateStatus: string;
    }>;
    tradingAction?: "WAIT" | "ENTER" | "SKIP" | "INVALIDATED";
    watchingSummary?: string | null;
    outcomeDetail?: string | null;
    outcomeR?: number | null;
    marketDataAt?: string | null;
    dataFeed?: string | null;
    dataFreshReason?: string | null;
    marketDataStatus?: {
      session: string;
      barsFresh: boolean;
      barsAgeSec: number | null;
      quotePresent: boolean;
      quoteFresh: boolean;
      quoteAgeSec: number | null;
      quoteUsableForEntry: boolean;
      verifiedForSetup: boolean;
      summary: string;
    } | null;
    entryGeometry?: {
      kind: string;
      summary: string;
      entryModelNote: string;
    };
    quoteTransparency?: {
      bid: number | null;
      ask: number | null;
      spreadPct: number | null;
      quoteAt: string | null;
      priceSource?: string;
      referencePriceOnly?: boolean;
      priceBasis: string;
    };
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
    symbol?: string;
    side?: "LONG" | "SHORT";
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
  gitCommit?: string | null;
  supportsFastSetup?: boolean;
  alpacaInteractivePriority?: boolean;
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
    strategyId?: string;
    strategyName: string;
    sampleSize: number;
    winRatePct: number | null;
    expectancyR: number | null;
    disclaimer: string;
    collapsedSummary?: string;
    walkForward?: {
      trainExpectancyR: number | null;
      validationExpectancyR: number | null;
      oosExpectancyR: number | null;
      expectancyDegradationR: number | null;
    };
  };
  text: string;
}

const DEFAULT_MARKET_TIMEOUT_MS = 22_000;

async function getJson<T>(
  path: string,
  headers?: Record<string, string>,
  opts?: { timeoutMs?: number; signal?: AbortSignal },
): Promise<T> {
  const timeoutMs = opts?.timeoutMs ?? DEFAULT_MARKET_TIMEOUT_MS;
  const ac = new AbortController();
  const timer = window.setTimeout(() => ac.abort(), timeoutMs);
  if (opts?.signal) {
    if (opts.signal.aborted) ac.abort();
    else opts.signal.addEventListener("abort", () => ac.abort(), { once: true });
  }
  try {
    const res = await fetch(apiUrl(path), {
      headers: headers && Object.keys(headers).length ? headers : undefined,
      signal: ac.signal,
    });
    const text = await res.text();
    const looksHtml = /^\s*<(!doctype|html|head|body)/i.test(text);
    if (!res.ok) {
      throw new Error(looksHtml ? `HTTP ${res.status}` : text || `HTTP ${res.status}`);
    }
    if (looksHtml) {
      throw new Error("Unexpected HTML from API (check VITE_API_BASE).");
    }
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new Error("Invalid JSON from market data API.");
    }
  } catch (err) {
    throw new Error(friendlyApiError(err));
  } finally {
    window.clearTimeout(timer);
  }
}

export function fetchSetup(
  ticker: string,
  side: "LONG" | "SHORT",
  opts?: {
    brief?: boolean;
    fast?: boolean;
    accessToken?: string | null;
    timeoutMs?: number;
    signal?: AbortSignal;
  },
) {
  const qs = new URLSearchParams({
    ticker,
    side,
  });
  if (opts?.brief) qs.set("brief", "1");
  if (opts?.fast) qs.set("fast", "1");
  const headers: Record<string, string> = {};
  if (opts?.accessToken) {
    headers.Authorization = `Bearer ${opts.accessToken}`;
  }
  return getJson<SetupResponse>(`/v1/setup?${qs}`, headers, {
    timeoutMs: opts?.timeoutMs,
    signal: opts?.signal,
  });
}

export function fetchBars(
  ticker: string,
  timeframe: string,
  limit = 80,
  opts?: { timeoutMs?: number; signal?: AbortSignal; extendedHours?: boolean },
) {
  const session = opts?.extendedHours ? "&session=all" : "";
  return getJson<BarsResponse>(
    `/v1/bars?ticker=${encodeURIComponent(ticker)}&timeframe=${encodeURIComponent(timeframe)}&limit=${limit}${session}`,
    undefined,
    opts,
  );
}

export interface SymbolSearchHit {
  symbol: string;
  name: string;
  match: "ticker" | "name";
}

export function searchSymbolsApi(q: string, limit = 12) {
  return getJson<{
    query: string;
    count: number;
    results: SymbolSearchHit[];
    note?: string;
  }>(`/v1/symbols/search?q=${encodeURIComponent(q)}&limit=${limit}`);
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

export function fetchStrategies() {
  return getJson<{
    strategies: Array<{ id: string; name: string; description?: string }>;
    note?: string;
  }>("/v1/strategies");
}

export interface BacktestCompareResponse {
  ticker: string;
  barCount: number;
  count: number;
  strategies: Array<{
    strategyId: string;
    strategyName: string;
    sampleSize: number;
    winRatePct: number | null;
    expectancyR: number | null;
    walkForward: {
      trainExpectancyR: number | null;
      validationExpectancyR: number | null;
      oosExpectancyR: number | null;
      expectancyDegradationR: number | null;
    } | null;
    disclaimer: string;
  }>;
  disclaimer: string;
  automaticOrders: false;
}

export function fetchBacktestCompare(ticker: string) {
  return getJson<BacktestCompareResponse>(
    `/v1/backtest/compare?ticker=${encodeURIComponent(ticker)}`,
  );
}

export interface MeasuredPerformanceResponse {
  minSampleForRate: number;
  sourceFilter: string;
  overall: {
    key: string;
    sampleSize: number;
    resolved: number;
    wins: number;
    losses: number;
    ambiguous: number;
    winRatePct: number | null;
    avgOutcomeR: number | null;
    liveValidatedCount: number;
    actionableCount: number;
    note: string;
  };
  bySymbol: Array<{
    key: string;
    sampleSize: number;
    wins: number;
    losses: number;
    winRatePct: number | null;
  }>;
  disclaimer: string;
  recordsConsidered: number;
  automaticOrders: false;
}

export function fetchMeasuredPerformance(
  source: "ALL" | "LIVE" | "HISTORICAL_REPLAY" | "LIVE_VALIDATED" = "ALL",
) {
  return getJson<MeasuredPerformanceResponse>(
    `/v1/measured-performance?source=${encodeURIComponent(source)}`,
  );
}

export async function markSignalLiveValidated(
  id: string,
  accessToken: string,
  note?: string,
) {
  try {
    const res = await fetch(apiUrl(`/v1/signals/${encodeURIComponent(id)}/live-validate`), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ note }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(body || `HTTP ${res.status}`);
    }
    return res.json() as Promise<{
      record: { id: string; liveValidated: boolean; symbol: string };
      automaticOrders: false;
      note: string;
    }>;
  } catch (err) {
    throw new Error(friendlyApiError(err));
  }
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

export interface OpportunityRow {
  symbol: string;
  side: "LONG" | "SHORT";
  rankScore: number;
  catalystBoost?: number;
  catalystHeadline?: string | null;
  features?: {
    lastPrice?: number;
    dayChangePct: number | null;
    vsSpyPct: number | null;
    rvolProxy: number | null;
    gapPct: number | null;
    sectorEtf?: string;
  };
  disclaimer?: string;
}

export interface OpportunitiesResponse {
  feed: string;
  universeSize: number;
  scanned: number;
  elapsedMs: number;
  discoveryElapsedMs?: number;
  confirmElapsedMs?: number;
  long: OpportunityRow[];
  short: OpportunityRow[];
  confirmed: Array<{
    symbol: string;
    side: "LONG" | "SHORT";
    discoveryRank: number;
    discoveryScore: number;
    state: string;
    statusLabel: string;
    rewardToRisk: number;
    qualityScore10: number | null;
  }>;
  disclaimer: string;
  automaticOrders: false;
}

export function fetchOpportunities(opts: {
  top?: number;
  confirm?: number;
  token?: string | null;
}) {
  const top = opts.top ?? 15;
  const confirm = opts.confirm ?? 0;
  return getJson<OpportunitiesResponse>(
    `/v1/opportunities?top=${top}&confirm=${confirm}`,
    opts.token ? { Authorization: `Bearer ${opts.token}` } : undefined,
  );
}

export function promoteToMonitor(
  symbols: Array<{ symbol: string; side: "LONG" | "SHORT" }>,
  accessToken: string,
) {
  return monitorFetch("/v1/monitor/promote", {
    method: "POST",
    body: { symbols },
    accessToken,
  });
}

export interface MonitorSymbolState {
  symbol: string;
  side: "LONG" | "SHORT";
  status: string;
  state: string;
  lastPrice: number | null;
  pctChange: number | null;
  alertAt: number | null;
  distanceToTriggerPct: number | null;
  distanceLabel: string | null;
  entryZone: { low: number; high: number; executable: boolean } | null;
  stop: number | null;
  t1: number | null;
  t2: number | null;
  rewardToRisk: number | null;
  conditionsPassed: number;
  conditionsTotal: number;
  setupScore: number | null;
  waitingFor: string[];
  dataFresh: boolean;
  session: string | null;
  nearActive: boolean;
  rankScore: number | null;
  vsSpyPct: number | null;
  vwapStatus: string | null;
  vwapLocation: string | null;
  rvol: number | null;
  fiveMinStatus: string | null;
  feed: string | null;
  feedLimitation: string | null;
  marketDataAt: string | null;
  evaluatedAt: string | null;
  qualityScore10: number | null;
  falseBreakoutRisk: string | null;
  actionHint: string | null;
  retestPhase: string | null;
  retestRequired: boolean;
  target3: number | null;
  invalidation: number | null;
  setupId: string | null;
  statusLabel: string;
  strategyName: string | null;
  indicatorChecklist: Array<{
    id: string;
    label: string;
    bias: "BULLISH" | "BEARISH" | "NEUTRAL" | "NOT VERIFIED";
    explanation: string;
    gateStatus: string;
  }>;
  tradingAction: "WAIT" | "ENTER" | "SKIP" | "INVALIDATED";
  watchingSummary: string | null;
  outcomeDetail: string | null;
  outcomeR: number | null;
  dataFreshReason?: string | null;
  entryGeometrySummary?: string | null;
  quoteSpreadPct?: number | null;
  error: string | null;
  updatedAt: string;
}

export interface MonitorSnapshot {
  sessionId: string;
  maxSymbols: number;
  /** Server-enforced watchlist cap (preview allowance or plan). */
  planMax?: number;
  intervalMs: number;
  running: boolean;
  symbols: Array<{ symbol: string; side: "LONG" | "SHORT" }>;
  states: MonitorSymbolState[];
  ranked: Array<{
    symbol: string;
    side: "LONG" | "SHORT";
    status: string;
    setupScore: number | null;
    nearActive: boolean;
    readinessScore?: number;
  }>;
  lastTickAt: string | null;
  tickCount: number;
  lastCycleMs?: number | null;
  note: string;
  feed?: string;
  automaticOrders?: false;
  hub?: {
    tickCount: number;
    lastTickAt: string | null;
    lastCycleMs: number | null;
    uniquePairsLastCycle: number;
    failedScansLastCycle: number;
    running: boolean;
  };
  defaultWatchlist?: Array<{ symbol: string; side: "LONG" | "SHORT" }>;
}

async function monitorFetch(
  path: string,
  opts?: { method?: string; body?: unknown; accessToken?: string | null },
): Promise<MonitorSnapshot> {
  try {
    const headers: Record<string, string> = {};
    if (opts?.accessToken) headers.Authorization = `Bearer ${opts.accessToken}`;
    if (opts?.body !== undefined) headers["Content-Type"] = "application/json";
    const res = await fetch(apiUrl(path), {
      method: opts?.method ?? "GET",
      headers: Object.keys(headers).length ? headers : undefined,
      body: opts?.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(/^\s*</.test(text) ? `HTTP ${res.status}` : text || `HTTP ${res.status}`);
    }
    if (/^\s*</.test(text)) {
      throw new Error("Unexpected HTML from API (check VITE_API_BASE).");
    }
    return JSON.parse(text) as MonitorSnapshot;
  } catch (err) {
    throw new Error(friendlyApiError(err));
  }
}

export function fetchMonitor(accessToken?: string | null) {
  return monitorFetch("/v1/monitor", { accessToken });
}

export function setMonitorWatchlist(
  symbols: Array<{ symbol: string; side: "LONG" | "SHORT" }>,
  accessToken?: string | null,
) {
  return monitorFetch("/v1/monitor/watchlist", {
    method: "PUT",
    body: { symbols },
    accessToken,
  });
}

export function addMonitorSymbol(
  symbol: string,
  side: "LONG" | "SHORT" = "LONG",
  accessToken?: string | null,
) {
  return monitorFetch("/v1/monitor/symbols", {
    method: "POST",
    body: { symbol, side },
    accessToken,
  });
}

export function removeMonitorSymbol(symbol: string, accessToken?: string | null) {
  return monitorFetch(`/v1/monitor/symbols/${encodeURIComponent(symbol)}`, {
    method: "DELETE",
    accessToken,
  });
}

export function forceMonitorTick(accessToken?: string | null) {
  return monitorFetch("/v1/monitor/tick", { method: "POST", accessToken });
}

export function loadDefaultMonitorWatchlist(accessToken?: string | null) {
  return monitorFetch("/v1/monitor/defaults", { method: "POST", accessToken });
}

export function fetchMonitorEvents(accessToken?: string | null, limit = 50) {
  return getJson<{
    count: number;
    events: Array<{
      id: string;
      symbol: string;
      side?: string;
      previousStatus: string;
      newStatus: string;
      eventAt: string;
      reason: string;
      dataFresh?: boolean;
    }>;
    delivery: string;
    note: string;
    preferences?: AlertPreferences;
    automaticOrders?: boolean;
  }>(`/v1/monitor/events?limit=${limit}`, accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined);
}

export interface AlertPreferences {
  userId: string;
  inAppEnabled: boolean;
  browserEnabled: boolean;
  emailEnabled: boolean;
  smsEnabled: boolean;
  pushEnabled: boolean;
  updatedAt: string;
}

export function fetchAlertPreferences(accessToken?: string | null) {
  return getJson<{
    preferences: AlertPreferences;
    channelsSupported: string[];
    channelsNotWired: string[];
    automaticOrders: boolean;
  }>("/v1/alert-preferences", accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined);
}

export async function saveAlertPreferencesApi(
  body: { inAppEnabled?: boolean; browserEnabled?: boolean },
  accessToken?: string | null,
) {
  try {
    const res = await fetch(apiUrl("/v1/alert-preferences"), {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
    return res.json() as Promise<{ preferences: AlertPreferences; note: string }>;
  } catch (err) {
    throw new Error(friendlyApiError(err));
  }
}

export interface SignalPerformanceRow {
  id: string;
  userId: string | null;
  symbol: string;
  side: string;
  state: string;
  source: "LIVE" | "HISTORICAL_REPLAY";
  qualityScore10: number | null;
  actionable: boolean;
  dataQualityOk: boolean;
  liveValidated: boolean;
  falseBreakoutRisk: string | null;
  signalTimestamp: string;
  outcomeStatus: string;
  outcomeR?: number | null;
}

export function fetchSignalPerformance(accessToken?: string | null, limit = 50) {
  return getJson<{
    summary: {
      total: number;
      actionable: number;
      invalidated: number;
      missed: number;
      liveValidated?: number;
      resolved?: number;
      wins?: number;
      losses?: number;
      ambiguous?: number;
      note: string;
    };
    records: SignalPerformanceRow[];
    note: string;
    automaticOrders: boolean;
  }>(
    `/v1/signal-performance?limit=${limit}`,
    accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
  );
}

export function fetchOpenSignalOutcomes(accessToken?: string | null) {
  return getJson<{
    open: Array<{
      id: string;
      symbol: string;
      side: string;
      entryPrice: number;
      entryAt: string;
      stop: number;
      target1: number;
      target2: number;
      barsElapsed: number;
      source: string;
    }>;
    count: number;
    note: string;
    automaticOrders: boolean;
  }>(
    "/v1/signal-outcomes",
    accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
  );
}

export function fetchSignalReplay(
  ticker: string,
  side: "LONG" | "SHORT" = "LONG",
  limit = 40,
) {
  return getJson<{
    symbol: string;
    side: string;
    label: string;
    steps: Array<{ barIndex: number; asOf: string; card: { state: string; statusLabel?: string } }>;
  transitions: Array<{ from: string; to: string; at: string; barIndex: number }>;
  outcomes?: Array<{
    id: string;
    detail: string;
    outcomeStatus: string;
    outcomeR: number | null;
    durationMs: number;
    barsElapsed: number;
    note: string;
  }>;
  automaticOrders: boolean;
  liveValidated?: boolean;
  note?: string;
  }>(`/v1/replay?ticker=${encodeURIComponent(ticker)}&side=${side}&limit=${limit}`);
}
