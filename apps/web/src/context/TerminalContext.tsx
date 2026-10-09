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
  fetchBars,
  fetchHealth,
  fetchSetup,
  type BarsResponse,
  type HealthResponse,
  type SetupResponse,
} from "../lib/api";
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
  }) => Promise<void>;
  data: SetupResponse | null;
  bars: BarsResponse | null;
  chartTf: string;
  setChartTf: (tf: string) => void;
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

const POLL_MS = 20_000;

export function TerminalProvider({ children }: { children: ReactNode }) {
  const { session, setCreditsLocal } = useAuth();
  const [symbol, setSymbol] = useState("NVDA");
  const [symbolDraft, setSymbolDraft] = useState("NVDA");
  const [side, setSide] = useState<"LONG" | "SHORT">("LONG");
  const [data, setData] = useState<SetupResponse | null>(null);
  const [bars, setBars] = useState<BarsResponse | null>(null);
  const [chartTf, setChartTf] = useState("5m");
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
    readJson(STORAGE_KEYS.inspectorOpen, true),
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
  const prevStatus = useRef<string | null>(null);
  const prevFresh = useRef<boolean | null>(null);
  const symbolRef = useRef(symbol);
  const sideRef = useRef(side);
  const chartTfRef = useRef(chartTf);
  symbolRef.current = symbol;
  sideRef.current = side;
  chartTfRef.current = chartTf;

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

  const loadBars = useCallback(async (sym: string, tf: string) => {
    setBarsLoading(true);
    setBarsError(null);
    try {
      const b = await fetchBars(sym, tf);
      setBars(b);
    } catch (err) {
      setBarsError(err instanceof Error ? err.message : String(err));
      setBars(null);
    } finally {
      setBarsLoading(false);
    }
  }, []);

  const scan = useCallback(
    async (opts?: { ticker?: string; side?: "LONG" | "SHORT"; brief?: boolean }) => {
      // Prefer explicit ticker/side; otherwise always read latest via refs so the
      // mount-time poll interval never snaps back to the initial NVDA default.
      const t = (opts?.ticker ?? symbolRef.current).trim().toUpperCase();
      const s = opts?.side ?? sideRef.current;
      const wantBrief = opts?.brief === true;
      if (!t) return;
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      setLoading(true);
      setError(null);
      setSymbol(t);
      setSymbolDraft(t);
      setSide(s);
      try {
        const next = await fetchSetup(t, s, {
          brief: wantBrief,
          accessToken: session?.access_token ?? null,
        });
        if (ac.signal.aborted) return;
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
        if (prevStatus.current && prevStatus.current !== status) {
          pushAlert({
            kind: alertKind,
            message: `${t} → ${status}${action ? ` · signal ${action}` : ""} (alert ≠ entry)`,
            symbol: t,
          });
        } else if (!prevStatus.current && status) {
          pushAlert({
            kind: alertKind === "data_stale" ? "data_stale" : "setup_found",
            message: `${t} setup ${status}${action ? ` · ${action}` : ""}`,
            symbol: t,
          });
        }
        if (prevFresh.current === true && fresh === false) {
          pushAlert({
            kind: "data_stale",
            message: `${t} data not verified / stale — fail closed`,
            symbol: t,
          });
        }
        const distPct = next.liveCard.nearActive?.distanceToTriggerPct;
        if (
          next.liveCard.nearActive?.active &&
          distPct != null &&
          Math.abs(distPct) <= 0.15 &&
          prevStatus.current !== status
        ) {
          pushAlert({
            kind: "trigger_approached",
            message: `${t} trigger approached (${next.liveCard.nearActive.distanceLabel})`,
            symbol: t,
          });
        }
        prevStatus.current = status;
        prevFresh.current = fresh;
        const recent: RecentScan = {
          at: Date.now(),
          symbol: t,
          side: s,
          status: action ? `${action} · ${status}` : status,
          score: next.liveCard.setupScoreValue ?? next.card.setupScore.total,
        };
        setRecentScans((prev) => {
          const nextList = [recent, ...prev.filter((r) => r.symbol !== t)].slice(0, 20);
          writeJson(STORAGE_KEYS.recentScans, nextList);
          return nextList;
        });
        void loadBars(t, chartTfRef.current);
      } catch (err) {
        if (!ac.signal.aborted) {
          setError(err instanceof Error ? err.message : String(err));
        }
      } finally {
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

  useEffect(() => {
    void scan({ brief: true });
    const id = window.setInterval(() => void scan({ brief: false }), POLL_MS);
    return () => {
      window.clearInterval(id);
      abortRef.current?.abort();
    };
    // initial + poll for current symbol/side — intentional
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (symbol) void loadBars(symbol, chartTf);
  }, [chartTf, symbol, loadBars]);

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
      chartTf,
      setChartTf,
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
      chartTf,
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
