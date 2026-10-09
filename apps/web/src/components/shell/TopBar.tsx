import { Bell, Coins, LogOut, Search, UserRound, Wifi, WifiOff } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useTerminal } from "../../context/TerminalContext";
import { formatEtClock } from "../../lib/format";

export function TopBar() {
  const {
    symbolDraft,
    setSymbolDraft,
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
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const id = window.setInterval(() => setClock(formatEtClock()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (
        e.key === "/" &&
        !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)
      ) {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === "Escape") {
        setInspectorOpen(false);
        inputRef.current?.blur();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setInspectorOpen]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const t = symbolDraft.trim().toUpperCase();
    if (!t) return;
    navigate("/scanner");
    void scan({ ticker: t, side, brief: true });
  }

  const sessionInfo = data?.liveCard.session ?? data?.card.session;
  const env = health?.accountEnvironment ?? "SIGNALS_ONLY";
  const feed = health?.alpacaFeed ?? "iex";
  const provider = health?.marketDataProvider ?? "—";

  return (
    <header className="topbar">
      <form className="top-search" onSubmit={onSubmit}>
        <Search size={14} aria-hidden="true" />
        <input
          ref={inputRef}
          value={symbolDraft}
          onChange={(e) => setSymbolDraft(e.target.value.toUpperCase())}
          placeholder="Symbol"
          aria-label="Symbol search"
          maxLength={8}
          autoComplete="off"
          spellCheck={false}
        />
        <kbd>/</kbd>
      </form>

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
