import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  fetchAlertPreferences,
  fetchBars,
  fetchHealth,
  fetchMonitorEvents,
  fetchSetup,
  friendlyApiError,
  type BarsResponse,
  type HealthResponse,
  type SetupResponse,
} from "../lib/api";
import { readBarsCache, writeBarsCache } from "../lib/barsCache";
import { barsForChart, historyLimit } from "../lib/regularSession";
import { isUserVisibleMonitorTransition } from "../lib/monitorDisplay";
import {
  closeMockPosition,
  openMockPosition,
  readMockPortfolio,
  readMockTradingMode,
  resetMockPortfolio,
  updateMockMarks,
  writeMockTradingMode,
  DEFAULT_MOCK_SHARES,
  type MockPortfolio,
} from "../lib/mockTrading";
import { readJson, STORAGE_KEYS, writeJson } from "../lib/storage";
import { useAuth } from "./AuthContext";

export type NavId =
  | "overview"
  | "scanner"
  | "watchlist"
  | "signals"
  | "charts"
  | "positions"
  | "orders"
  | "alerts"
  | "journal"
  | "backtest"
  | "news"
  | "settings";

export interface LocalAlert {
  id: string;
  at: number;
  kind: string;
  message: string;
  symbol?: string;
}

export interface RecentScan {
  at: number;
  symbol: string;
  side: "LONG" | "SHORT";
  status: string;
  score: number | null;
  dataFresh?: boolean;
  tradingAction?: string;
}

interface TerminalContextValue {
  symbol: string;
  side: "LONG" | "SHORT";
  setSymbolDraft: (s: string) => void;
  symbolDraft: string;
  setSide: (s: "LONG" | "SHORT") => void;
  scan: (opts?: {
    ticker?: string;
    side?: "LONG" | "SHORT";
    /** Request ChatGPT brief (credits). Default false for polls. */
    brief?: boolean;
    fast?: boolean;
    refreshBars?: boolean;
    poll?: boolean;
  }) => Promise<void>;
  data: SetupResponse | null;
  bars: BarsResponse | null;
  /** Authoritative last for header/levels — setup quote when present, else matching bars. */
  displayPrice: number | null;
  /** Session/day % from setup relativeMomentum when available. */
  dayChangePct: number | null;
  chartTf: string;
  setChartTf: (tf: string) => void;
  extendedHours: boolean;
  setExtendedHours: (on: boolean) => void;
  /** Preview: off-RTH diagnostic scan via API `lab=1` (ENTER still blocked). */
  labTestDataMode: boolean;
  setLabTestDataMode: (on: boolean) => void;
  /** Local paper portfolio — no broker orders. */
  mockTradingMode: boolean;
  setMockTradingMode: (on: boolean) => void;
  mockPortfolio: MockPortfolio;
  simulateMockEntry: () => { ok: boolean; message: string };
  closeMockPositionById: (positionId: string, exitPrice: number, reason?: string) => {
    ok: boolean;
    message: string;
  };
  resetMockTrading: () => void;
  loading: boolean;
  barsLoading: boolean;
  error: string | null;
  barsError: string | null;
  updatedAt: number | null;
  health: HealthResponse | null;
  feedConnected: boolean;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (v: boolean) => void;
  inspectorOpen: boolean;
  setInspectorOpen: (v: boolean) => void;
  bottomDockOpen: boolean;
  setBottomDockOpen: (v: boolean) => void;
  watchlist: string[];
  toggleWatchlist: (sym: string) => void;
  notes: Record<string, string>;
  setNote: (sym: string, text: string) => void;
  alerts: LocalAlert[];
  pushAlert: (a: Omit<LocalAlert, "id" | "at">) => void;
  clearAlerts: () => void;
  recentScans: RecentScan[];
  selectSymbol: (sym: string, opts?: { brief?: boolean }) => void;
}

const TerminalContext = createContext<TerminalContextValue | null>(null);

const POLL_MS = 15_000;

export function TerminalProvider({ children }: { children: ReactNode }) {
  const { session, setCreditsLocal } = useAuth();
  const [symbol, setSymbol] = useState("NVDA");
  const [symbolDraft, setSymbolDraft] = useState("NVDA");
  const [side, setSide] = useState<"LONG" | "SHORT">("LONG");
  const [data, setData] = useState<SetupResponse | null>(null);
  const [bars, setBars] = useState<BarsResponse | null>(null);
  const [chartTf, setChartTf] = useState("5m");
  const [extendedHours, setExtendedHoursState] = useState(() => {
    try {
      return localStorage.getItem("wulu:extended-hours") === "1";
    } catch {
      return false;
    }
  });
  const [labTestDataMode, setLabTestDataModeState] = useState(() => {
    try {
      return localStorage.getItem("wulu:lab-test-data") === "1";
    } catch {
      return false;
    }
  });
  const [mockTradingMode, setMockTradingModeState] = useState(() => readMockTradingMode());
  const [mockPortfolio, setMockPortfolio] = useState<MockPortfolio>(() => readMockPortfolio());
  const [loading, setLoading] = useState(false);
  const [barsLoading, setBarsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [barsError, setBarsError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [sidebarCollapsed, setSidebarCollapsedState] = useState(() =>
    readJson(STORAGE_KEYS.sidebarCollapsed, false),
  );
  const [inspectorOpen, setInspectorOpenState] = useState(() =>
    readJson(STORAGE_KEYS.inspectorOpen, false),
  );
  const [bottomDockOpen, setBottomDockOpenState] = useState(() =>
    readJson(STORAGE_KEYS.bottomDockOpen, false),
  );
  const [watchlist, setWatchlist] = useState<string[]>(() =>
    readJson(STORAGE_KEYS.watchlist, ["NVDA", "AAPL", "SPY", "TSLA"]),
  );
  const [notes, setNotes] = useState<Record<string, string>>(() =>
    readJson(STORAGE_KEYS.notes, {}),
  );
  const [alerts, setAlerts] = useState<LocalAlert[]>(() =>
    readJson(STORAGE_KEYS.alerts, []),
  );
  const [recentScans, setRecentScans] = useState<RecentScan[]>(() =>
    readJson(STORAGE_KEYS.recentScans, []),
  );

  const abortRef = useRef<AbortController | null>(null);
  const setupInflightRef = useRef(false);
  const prevStatus = useRef<string | null>(null);
  const prevFresh = useRef<boolean | null>(null);
  const triggerAlerted = useRef("");
  const symbolRef = useRef(symbol);
  const sideRef = useRef(side);
  const chartTfRef = useRef(chartTf);
  const extendedRef = useRef(false);
  const labTestRef = useRef(false);
  const healthRef = useRef<HealthResponse | null>(null);
  symbolRef.current = symbol;
  sideRef.current = side;
  chartTfRef.current = chartTf;
  extendedRef.current = extendedHours;
  labTestRef.current = labTestDataMode;
  healthRef.current = health;

  const setSidebarCollapsed = useCallback((v: boolean) => {
    setSidebarCollapsedState(v);
    writeJson(STORAGE_KEYS.sidebarCollapsed, v);
  }, []);
  const setInspectorOpen = useCallback((v: boolean) => {
    setInspectorOpenState(v);
    writeJson(STORAGE_KEYS.inspectorOpen, v);
  }, []);
  const setBottomDockOpen = useCallback((v: boolean) => {
    setBottomDockOpenState(v);
    writeJson(STORAGE_KEYS.bottomDockOpen, v);
  }, []);

  const pushAlert = useCallback((a: Omit<LocalAlert, "id" | "at">) => {
    setAlerts((prev) => {
      // Dedupe identical kind+symbol+message within 60s — alert ≠ entry permission.
      const now = Date.now();
      const dup = prev.find(
        (x) =>
          x.kind === a.kind &&
          x.symbol === a.symbol &&
          x.message === a.message &&
          now - x.at < 60_000,
      );
      if (dup) return prev;
      const next = [{ ...a, id: crypto.randomUUID(), at: now }, ...prev].slice(0, 100);
      writeJson(STORAGE_KEYS.alerts, next);
      return next;
    });
  }, []);

  const clearAlerts = useCallback(() => {
    setAlerts([]);
    writeJson(STORAGE_KEYS.alerts, []);
  }, []);

  const toggleWatchlist = useCallback((sym: string) => {
    const s = sym.toUpperCase();
    setWatchlist((prev) => {
      const next = prev.includes(s) ? prev.filter((x) => x !== s) : [s, ...prev].slice(0, 40);
      writeJson(STORAGE_KEYS.watchlist, next);
      return next;
    });
  }, []);

  const setNote = useCallback((sym: string, text: string) => {
    setNotes((prev) => {
      const next = { ...prev, [sym.toUpperCase()]: text };
      writeJson(STORAGE_KEYS.notes, next);
      return next;
    });
  }, []);

  const barsAbortRef = useRef<AbortController | null>(null);
  const barsSeqRef = useRef(0);
  const barsInflightKeyRef = useRef("");

  const FAST_BAR_LIMIT = 40;

  const loadBars = useCallback(async (sym: string, tf: string, opts?: { soft?: boolean; limit?: number }) => {
    const target = sym.trim().toUpperCase();
    if (!target) return;
    const extended = extendedRef.current;
    const key = `${target}|${tf}|${extended ? "all" : "rth"}`;
    if (barsAbortRef.current && barsInflightKeyRef.current === key) {
      return;
    }
    barsAbortRef.current?.abort();
    const ac = new AbortController();
    barsAbortRef.current = ac;
    barsInflightKeyRef.current = key;
    const seq = ++barsSeqRef.current;
    const soft = opts?.soft === true;
    const limit = opts?.limit ?? historyLimit(tf);
    // Hard switch: clear so prior symbol candles never linger.
    // Soft refresh (setup poll): keep candles until the new series arrives.
    if (!soft) {
      const cached = readBarsCache(target, tf, extended);
      if (cached) {
        setBars(cached);
        setBarsLoading(false);
      } else {
        setBars(null);
        setBarsLoading(true);
      }
    }
    setBarsError(null);
    try {
      const b = await fetchBars(target, tf, limit, { signal: ac.signal, extendedHours: extended });
      if (ac.signal.aborted || seq !== barsSeqRef.current) return;
      if (b.symbol && b.symbol.toUpperCase() !== target) return;
      const shown = barsForChart(b.bars, tf, extended);
      const sessionBars = { ...b, bars: shown, count: shown.length };
      setBars(sessionBars);
      writeBarsCache(target, tf, sessionBars, extended);
      const fullLimit = historyLimit(tf);
      if (limit < fullLimit && !ac.signal.aborted && seq === barsSeqRef.current) {
        const refineSeq = seq;
        window.setTimeout(() => {
          if (refineSeq !== barsSeqRef.current) return;
          void (async () => {
            try {
              const full = await fetchBars(target, tf, fullLimit, { extendedHours: extended });
              if (refineSeq !== barsSeqRef.current || extendedRef.current !== extended) return;
              const fullShown = barsForChart(full.bars, tf, extended);
              const fullSession = { ...full, bars: fullShown, count: fullShown.length };
              setBars(fullSession);
              writeBarsCache(target, tf, fullSession, extended);
            } catch {
              /* keep fast candles visible */
            }
          })();
        }, 50);
      }
    } catch (err) {
      if (seq !== barsSeqRef.current) return;
      if (ac.signal.aborted) {
        setBarsError("Chart request was interrupted. Tap Retry.");
        return;
      }
      setBarsError(friendlyApiError(err));
      if (!soft && !readBarsCache(target, tf, extended)) setBars(null);
    } finally {
      if (barsInflightKeyRef.current === key) barsInflightKeyRef.current = "";
      if (seq === barsSeqRef.current) setBarsLoading(false);
    }
  }, []);

  const setExtendedHours = useCallback((on: boolean) => {
    extendedRef.current = on;
    setExtendedHoursState(on);
    try {
      localStorage.setItem("wulu:extended-hours", on ? "1" : "0");
    } catch {
      /* private mode */
    }
    const sym = symbolRef.current;
    if (sym) void loadBars(sym, chartTfRef.current);
  }, [loadBars]);

  const setLabTestDataMode = useCallback(
    (on: boolean) => {
      setLabTestDataModeState(on);
      try {
        localStorage.setItem("wulu:lab-test-data", on ? "1" : "0");
      } catch {
        /* private mode */
      }
      if (on) setExtendedHours(true);
    },
    [setExtendedHours],
  );

  const setMockTradingMode = useCallback((on: boolean) => {
    setMockTradingModeState(on);
    writeMockTradingMode(on);
  }, []);

  const resetMockTrading = useCallback(() => {
    setMockPortfolio(resetMockPortfolio());
  }, []);

  const simulateMockEntry = useCallback((): { ok: boolean; message: string } => {
    if (!mockTradingMode) {
      return { ok: false, message: "Turn on mock trading in Settings first." };
    }
    const lc = data?.liveCard;
    if (!lc) return { ok: false, message: "Run a scan before simulating entry." };
    const sym = (lc.symbol ?? symbolRef.current).trim().toUpperCase();
    const s = sideRef.current;
    const entryMid =
      lc.entryZone != null ? (lc.entryZone.low + lc.entryZone.high) / 2 : null;
    const chartClose =
      bars?.symbol?.toUpperCase() === sym ? bars.bars.at(-1)?.close : null;
    const px =
      (chartClose != null && Number.isFinite(chartClose) ? chartClose : null) ??
      entryMid ??
      lc.lastPrice ??
      lc.alertAt;
    const action = lc.tradingAction ?? "WAIT";
    const practiceNote =
      action === "ENTER"
        ? "Practice entry at setup levels (rules said ENTER — still not a real order)."
        : `Practice entry while engine shows ${action} — learning only, not permission.`;
    const { portfolio, error } = openMockPosition({
      symbol: sym,
      side: s,
      shares: DEFAULT_MOCK_SHARES,
      entryPrice: px,
      stop: lc.stop,
      t1: lc.t1,
      t2: lc.t2,
      setupAction: action,
      practiceNote,
    });
    setMockPortfolio(portfolio);
    if (error) return { ok: false, message: error };
    return {
      ok: true,
      message: `Simulated ${s} ${DEFAULT_MOCK_SHARES} sh ${sym} @ ${px.toFixed(2)}. See Positions.`,
    };
  }, [mockTradingMode, data, bars]);

  const closeMockPositionById = useCallback(
    (positionId: string, exitPrice: number, reason?: string) => {
      const { portfolio, error, pnl } = closeMockPosition({
        positionId,
        exitPrice,
        reason,
      });
      setMockPortfolio(portfolio);
      if (error) return { ok: false, message: error };
      const pnlStr = pnl != null && Number.isFinite(pnl) ? ` P/L ${pnl >= 0 ? "+" : ""}$${pnl.toFixed(2)}.` : "";
      return { ok: true, message: `Closed practice position.${pnlStr}` };
    },
    [],
  );

  const scan = useCallback(
    async (opts?: {
      ticker?: string;
      side?: "LONG" | "SHORT";
      brief?: boolean;
      /** Lighter Alpaca snapshot (quote + 5m bars) for faster first paint. */
      fast?: boolean;
      /** Soft bar refresh (poll) — keeps chart candles current without clearing. */
      refreshBars?: boolean;
      /** Background refresh. Must not cancel an in-flight symbol switch. */
      poll?: boolean;
    }) => {
      // Prefer explicit ticker/side; otherwise always read latest via refs so the
      // mount-time poll interval never snaps back to the initial NVDA default.
      const t = (opts?.ticker ?? symbolRef.current).trim().toUpperCase();
      const s = opts?.side ?? sideRef.current;
      const wantBrief = opts?.brief === true;
      if (!t) return;
      const symbolChanged = t !== symbolRef.current;
      const isPoll = opts?.poll === true;
      // Polls must not cancel a symbol switch that is still waiting on Alpaca.
      // That abort loop is what left the chart on "Loading MU…" with no price.
      if (isPoll) {
        if (opts?.refreshBars) {
          void loadBars(t, chartTfRef.current, { soft: true, limit: historyLimit(chartTfRef.current) });
        }
      } else {
        abortRef.current?.abort();
      }
      const ac = new AbortController();
      abortRef.current = ac;
      if (symbolChanged) setLoading(true);
      if (!isPoll) setError(null);
      setSymbol(t);
      setSymbolDraft(t);
      setSide(s);
      if (symbolChanged) {
        setData(null);
        setBars(null);
      }
      const useFastPath = symbolChanged || opts?.fast === true;
      const barLimit = useFastPath ? FAST_BAR_LIMIT : historyLimit(chartTfRef.current);
      // Bars first. A parallel setup call uses the same Alpaca queue and delays the chart.
      if (!isPoll && (symbolChanged || opts?.fast === true)) {
        await loadBars(t, chartTfRef.current, { soft: !symbolChanged, limit: barLimit });
        if (ac.signal.aborted || symbolRef.current !== t) return;
      }
      setupInflightRef.current = true;
      try {
        const useLab =
          labTestRef.current &&
          healthRef.current?.monitor?.wuluLabModeEnabled === true;
        const next = await fetchSetup(t, s, {
          brief: wantBrief,
          fast: useFastPath,
          lab: useLab,
          accessToken: session?.access_token ?? null,
          signal: ac.signal,
        });
        if (ac.signal.aborted || symbolRef.current !== t) return;
        setData(next);
        setUpdatedAt(Date.now());
        const charged = next.signalRecommendation?.creditsCharged ?? 0;
        const remaining = next.signalRecommendation?.creditsRemaining;
        if (charged > 0 && remaining != null) {
          setCreditsLocal(remaining);
        }
        const status = next.liveCard.status;
        const state = next.liveCard.state ?? next.card.state;
        const fresh = next.liveCard.dataFresh ?? next.card.dataFresh;
        const action = next.signalRecommendation?.action;
        const alertKind = classifySetupAlert(status, state, fresh);
        // Track status per-symbol so hopping tickers does not false-fire alerts.
        const statusKey = `${t}:${s}`;
        const prevKey = prevStatus.current;
        if (prevKey?.startsWith(`${t}:`) && prevKey !== `${statusKey}:${status}`) {
          const prevSt = prevKey.slice(statusKey.length + 1);
          if (prevSt && prevSt !== status && isCustomerAlert(alertKind)) {
            pushAlert({
              kind: alertKind,
              message: `${t} → ${status}${action ? ` · signal ${action}` : ""} (alert ≠ entry)`,
              symbol: t,
            });
          }
        }
        const distPct = next.liveCard.nearActive?.distanceToTriggerPct;
        if (
          next.liveCard.nearActive?.active &&
          distPct != null &&
          Math.abs(distPct) <= 0.15 &&
          prevKey?.startsWith(`${t}:`) &&
          triggerAlerted.current !== `${t}:${status}`
        ) {
          triggerAlerted.current = `${t}:${status}`;
          pushAlert({
            kind: "trigger_approached",
            message: `${t} trigger approached (${next.liveCard.nearActive.distanceLabel})`,
            symbol: t,
          });
        }
        if (!next.liveCard.nearActive?.active) triggerAlerted.current = "";
        prevStatus.current = `${statusKey}:${status}`;
        prevFresh.current = fresh;
        const tradeAction = next.liveCard.tradingAction ?? action ?? "WAIT";
        const recent: RecentScan = {
          at: Date.now(),
          symbol: t,
          side: s,
          status: `${tradeAction} · ${status}`,
          score: next.liveCard.setupScoreValue ?? next.card.setupScore.total,
          dataFresh: fresh,
          tradingAction: tradeAction,
        };
        setRecentScans((prev) => {
          const nextList = [recent, ...prev.filter((r) => r.symbol !== t)].slice(0, 20);
          writeJson(STORAGE_KEYS.recentScans, nextList);
          return nextList;
        });
      } catch (err) {
        if (!ac.signal.aborted) {
          setError(friendlyApiError(err));
        }
      } finally {
        setupInflightRef.current = false;
        if (!ac.signal.aborted) setLoading(false);
      }
    },
    [loadBars, pushAlert, session?.access_token, setCreditsLocal],
  );

  const selectSymbol = useCallback(
    (sym: string, opts?: { brief?: boolean }) => {
      // Watchlist / quick picks default to rules refresh (no credit drain).
      // Pass brief: true when the user explicitly wants a model brief.
      void scan({ ticker: sym, side: sideRef.current, brief: opts?.brief === true });
    },
    [scan],
  );

  useEffect(() => {
    void fetchHealth()
      .then(setHealth)
      .catch(() => setHealth(null));
    const id = window.setInterval(() => {
      void fetchHealth()
        .then(setHealth)
        .catch(() => setHealth(null));
    }, 30_000);
    return () => window.clearInterval(id);
  }, []);

  // Server monitor alerts → in-app feed (+ browser notification when enabled).
  const serverAlertSeen = useRef<Set<string>>(new Set());
  useEffect(() => {
    const token = session?.access_token ?? null;
    if (!token) return;
    let cancelled = false;
    const pull = async () => {
      try {
        const [ev, prefs] = await Promise.all([
          fetchMonitorEvents(token, 30),
          fetchAlertPreferences(token).catch(() => null),
        ]);
        if (cancelled) return;
        const browserOn = Boolean(prefs?.preferences.browserEnabled);
        for (const e of ev.events) {
          if (serverAlertSeen.current.has(e.id)) continue;
          if (!isUserVisibleMonitorTransition(e.previousStatus, e.newStatus)) continue;
          serverAlertSeen.current.add(e.id);
          if (prefs?.preferences.inAppEnabled === false) continue;
          pushAlert({
            kind: `monitor_${e.newStatus}`.slice(0, 40),
            message: `${e.symbol}${e.side ? ` ${e.side}` : ""}: ${e.previousStatus} → ${e.newStatus} · ${e.reason}`.slice(
              0,
              200,
            ),
            symbol: e.symbol,
          });
          if (
            browserOn &&
            typeof Notification !== "undefined" &&
            Notification.permission === "granted"
          ) {
            new Notification(`WULU · ${e.symbol}`, {
              body: `${e.previousStatus} → ${e.newStatus}`,
              tag: e.id,
            });
          }
        }
      } catch {
        /* auth/monitor optional while browsing other pages */
      }
    };
    void pull();
    const id = window.setInterval(() => void pull(), 15_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [session?.access_token, pushAlert]);

  useEffect(() => {
    // Fast first paint: small bar fetch + lighter setup snapshot; brief=1 avoids OpenAI.
    void scan({ brief: false, fast: true });
    const id = window.setInterval(
      () => void scan({ brief: false, fast: true, poll: true, refreshBars: true }),
      POLL_MS,
    );
    return () => {
      window.clearInterval(id);
      abortRef.current?.abort();
    };
    // initial + poll for current symbol/side — intentional
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const chartTfRefInit = useRef(chartTf);
  useEffect(() => {
    // Only when user changes timeframe — scan() already loads bars on symbol/setup refresh.
    if (chartTfRefInit.current === chartTf) return;
    chartTfRefInit.current = chartTf;
    if (symbol) void loadBars(symbol, chartTf);
  }, [chartTf, symbol, loadBars]);

  const displayPrice = useMemo(() => {
    // Header price is the active chart's last candle close, not a quote patched onto the bar.
    if (bars?.symbol?.toUpperCase() === symbol.toUpperCase()) {
      const close = bars.bars.at(-1)?.close;
      if (close != null && Number.isFinite(close)) return close;
    }
    const setupPx = data?.liveCard.lastPrice ?? data?.card.lastPrice;
    if (setupPx != null && Number.isFinite(setupPx) && setupPx > 0) return setupPx;
    return null;
  }, [bars, data, symbol]);

  const dayChangePct = useMemo(() => {
    const pct = data?.liveCard.relativeMomentum?.symbolIntradayPct;
    return pct != null && Number.isFinite(pct) ? pct : null;
  }, [data]);

  useEffect(() => {
    if (!mockTradingMode || displayPrice == null || !Number.isFinite(displayPrice)) return;
    setMockPortfolio(updateMockMarks(symbol, displayPrice));
  }, [mockTradingMode, symbol, displayPrice]);

  const value = useMemo<TerminalContextValue>(
    () => ({
      symbol,
      side,
      setSymbolDraft,
      symbolDraft,
      setSide,
      scan,
      data,
      bars,
      displayPrice,
      dayChangePct,
      chartTf,
      setChartTf,
      extendedHours,
      setExtendedHours,
      labTestDataMode,
      setLabTestDataMode,
      mockTradingMode,
      setMockTradingMode,
      mockPortfolio,
      simulateMockEntry,
      closeMockPositionById,
      resetMockTrading,
      loading,
      barsLoading,
      error,
      barsError,
      updatedAt,
      health,
      feedConnected: health?.ok === true && !error,
      sidebarCollapsed,
      setSidebarCollapsed,
      inspectorOpen,
      setInspectorOpen,
      bottomDockOpen,
      setBottomDockOpen,
      watchlist,
      toggleWatchlist,
      notes,
      setNote,
      alerts,
      pushAlert,
      clearAlerts,
      recentScans,
      selectSymbol,
    }),
    [
      symbol,
      side,
      symbolDraft,
      scan,
      data,
      bars,
      displayPrice,
      dayChangePct,
      chartTf,
      extendedHours,
      setExtendedHours,
      labTestDataMode,
      setLabTestDataMode,
      mockTradingMode,
      setMockTradingMode,
      mockPortfolio,
      simulateMockEntry,
      closeMockPositionById,
      resetMockTrading,
      loading,
      barsLoading,
      error,
      barsError,
      updatedAt,
      health,
      sidebarCollapsed,
      setSidebarCollapsed,
      inspectorOpen,
      setInspectorOpen,
      bottomDockOpen,
      setBottomDockOpen,
      watchlist,
      toggleWatchlist,
      notes,
      setNote,
      alerts,
      pushAlert,
      clearAlerts,
      recentScans,
      selectSymbol,
    ],
  );

  return <TerminalContext.Provider value={value}>{children}</TerminalContext.Provider>;
}

export function useTerminal() {
  const ctx = useContext(TerminalContext);
  if (!ctx) throw new Error("useTerminal outside provider");
  return ctx;
}

function isCustomerAlert(kind: string): boolean {
  return (
    kind === "near_active" ||
    kind === "entry_zone_active" ||
    kind === "missed" ||
    kind === "invalidated" ||
    kind === "completed_confirmation" ||
    kind === "trigger_approached"
  );
}

/** Map setup status → local alert kind. Never implies order permission. */
function classifySetupAlert(status: string, state: string | undefined, fresh: boolean): string {
  const u = `${status} ${state ?? ""}`.toUpperCase();
  if (!fresh || u.includes("DATA NOT VERIFIED") || u.includes("DATA_NOT_VERIFIED")) {
    return "data_stale";
  }
  if (u.includes("NEAR")) return "near_active";
  if (u.includes("ENTRY ACTIVE") || u.includes("ENTRY_ACTIVE")) return "entry_zone_active";
  if (u.includes("MISSED")) return "missed";
  if (u.includes("INVALIDATED")) return "invalidated";
  if (u.includes("CONFIRM") || u.includes("COMPLETED")) return "completed_confirmation";
  return "setup_found";
}
