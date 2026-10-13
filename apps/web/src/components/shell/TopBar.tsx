import { Bell, Coins, LogOut, UserRound, Wifi, WifiOff } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SymbolSearch } from "../search/SymbolSearch";
import { useAuth } from "../../context/AuthContext";
import { useTerminal } from "../../context/TerminalContext";
import { formatEtClock } from "../../lib/format";

export function TopBar() {
  const {
    symbol,
    scan,
    side,
    health,
    feedConnected,
    data,
    alerts,
    setInspectorOpen,
    inspectorOpen,
  } = useTerminal();
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

  return (
    <header className="topbar">
      <SymbolSearch
        initial={symbol}
        size="top"
        onSelect={(s) => {
          navigate("/scanner");
          void scan({ ticker: s, side, brief: false });
        }}
      />

      <div className="top-meta">
        {sessionInfo ? (
          <span
            className={`badge ${sessionInfo.session === "RTH" ? "green" : sessionInfo.session.includes("HOUR") || sessionInfo.session === "PREMARKET" ? "amber" : ""}`}
            title={sessionInfo.reason}
          >
            {sessionInfo.session}
          </span>
        ) : (
          <span className="badge">SESSION UNKNOWN</span>
        )}

        <span className={`badge ${feedConnected ? "teal" : "red"}`} title="Market data API connectivity">
          {feedConnected ? <Wifi size={12} /> : <WifiOff size={12} />}
          <span className="dot" />
          FEED {feedConnected ? "OK" : "DOWN"}
        </span>

        <span className="badge blue hide-sm" title="Data source">
          {provider.toUpperCase()} · {feed.toUpperCase()}
        </span>

        <span className="badge amber" title="Execution environment">
          {env}
        </span>

        {configured && session && (
          <>
            <button
              type="button"
              className="badge teal"
              title="Credits remaining"
              onClick={() => navigate("/billing")}
              style={{ cursor: "pointer" }}
            >
              <Coins size={12} />
              {profile?.credits_balance ?? "—"} CR
            </button>
            <button
              type="button"
              className="badge"
              title="Current plan"
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
