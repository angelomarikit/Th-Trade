import { Bell, Coins, LogOut, UserRound, Wifi, WifiOff } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SymbolSearch } from "../search/SymbolSearch";
import { useAuth } from "../../context/AuthContext";
import { useTerminal } from "../../context/TerminalContext";
import { useOpenSymbol } from "../../hooks/useOpenSymbol";
import { formatEtClock } from "../../lib/format";

export function TopBar() {
  const {
    symbol,
    health,
    feedConnected,
    data,
    alerts,
    setInspectorOpen,
    inspectorOpen,
    loading,
  } = useTerminal();
  const openSymbol = useOpenSymbol();
  const { profile, plan, signOut, configured, session } = useAuth();
  const [clock, setClock] = useState(() => formatEtClock());
  const navigate = useNavigate();

  useEffect(() => {
    const id = window.setInterval(() => setClock(formatEtClock()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setInspectorOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setInspectorOpen]);

  const sessionInfo = data?.liveCard.session ?? data?.card.session;
  const env = health?.accountEnvironment ?? "SIGNALS_ONLY";
  const feed = health?.alpacaFeed ?? "iex";
  const provider = health?.marketDataProvider ?? "—";
  const webSha = import.meta.env.VITE_BUILD_SHA ?? "local";
  const apiSha = (health?.gitCommit ?? "unknown").slice(0, 7);

  return (
    <header className="topbar">
      <SymbolSearch
        initial={symbol}
        size="top"
        onSelect={(s) => openSymbol(s, { brief: false })}
      />

      <div className="top-meta">
        {sessionInfo ? (
          <span
            className={`badge ${sessionInfo.session === "RTH" ? "green" : sessionInfo.session.includes("HOUR") || sessionInfo.session === "PREMARKET" ? "amber" : ""}`}
            title={sessionInfo.reason}
          >
            {sessionInfo.session}
          </span>
        ) : loading ? (
          <span className="badge amber" title="Loading market session">
            Sync…
          </span>
        ) : (
          <span className="badge">SESSION —</span>
        )}

        <span
          className={`badge ${feedConnected ? "teal" : "red"}`}
          title="WULU API reachability only — not verified NBBO or entry permission"
        >
          {feedConnected ? <Wifi size={12} /> : <WifiOff size={12} />}
          <span className="dot" />
          <span className="feed-label">API {feedConnected ? "OK" : "DOWN"}</span>
        </span>

        <span className="badge blue show-mobile-only" title="Data feed">
          {(feed ?? "iex").toUpperCase()}
        </span>

        <span className="badge blue hide-sm" title="Data source">
          {provider.toUpperCase()} · {feed.toUpperCase()}
        </span>

        <span className="badge amber hide-sm" title="Execution environment">
          {env}
        </span>

        <span
          className="badge build-stamp hide-sm"
          title="Deployed build: web commit / API commit. Put this in every test screenshot."
        >
          web {webSha} · api {apiSha}
        </span>

        <span
          className="badge build-stamp build-stamp-mobile show-mobile-only"
          title="Preview build stamp — web / API git SHAs"
        >
          BUILD {webSha} · {apiSha}
        </span>

        {configured && session && (
          <>
            <button
              type="button"
              className="badge teal hide-mobile"
              title="Credits remaining. Open Plans from Settings."
              onClick={() => navigate("/billing")}
              style={{ cursor: "pointer" }}
            >
              <Coins size={12} />
              {profile?.credits_balance ?? "—"} CR
            </button>
            <button
              type="button"
              className="badge hide-mobile"
              title="Current plan. Open Plans from Settings."
              onClick={() => navigate("/billing")}
              style={{ cursor: "pointer" }}
            >
              {(plan?.name ?? profile?.plan_tier ?? "FREE").toUpperCase()}
            </button>
          </>
        )}

        <button
          type="button"
          className="icon-btn"
          disabled={alerts.length === 0}
          title={alerts.length ? `${alerts.length} local alerts` : "No push alerts configured"}
          onClick={() => navigate("/alerts")}
        >
          <Bell size={15} />
          {alerts.length > 0 && <span>{alerts.length}</span>}
        </button>

        <button
          type="button"
          className="icon-btn hide-sm"
          onClick={() => setInspectorOpen(!inspectorOpen)}
          title="Toggle inspector"
        >
          Inspector
        </button>

        {configured && session ? (
          <button
            type="button"
            className="icon-btn"
            title={profile?.email ?? "Account"}
            onClick={() => void signOut().then(() => navigate("/login"))}
          >
            <LogOut size={14} />
          </button>
        ) : configured ? (
          <button type="button" className="icon-btn" onClick={() => navigate("/login")}>
            <UserRound size={14} />
          </button>
        ) : null}

        <time className="clock">{clock}</time>
      </div>
    </header>
  );
}
