import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "../components/ui/PageHeader";
import { StatusBadge } from "../components/ui/StatusBadge";
import { useAuth } from "../context/AuthContext";
import { useOpenSymbol } from "../hooks/useOpenSymbol";
import { mergeMonitorRows } from "../lib/mergeMonitorRows";
import {
  formatMonitorEventChange,
  formatMonitorEventReason,
} from "../lib/monitorDisplay";
import {
  addMonitorSymbol,
  fetchMonitor,
  fetchMonitorEvents,
  forceMonitorTick,
  loadDefaultMonitorWatchlist,
  removeMonitorSymbol,
  type MonitorSnapshot,
  type MonitorSymbolState,
} from "../lib/api";
import { fmtPct, fmtPrice, formatEtTime } from "../lib/format";

function fmtDataTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return formatEtTime(iso);
}
export function WatchlistPage() {
  const { session, configured, plan } = useAuth();
  const openSymbol = useOpenSymbol();
  const token = session?.access_token ?? null;
  const signedIn = !!session?.access_token;

  const [snap, setSnap] = useState<MonitorSnapshot | null>(null);
  const [events, setEvents] = useState<
    Array<{ id: string; symbol: string; previousStatus: string; newStatus: string; eventAt: string; reason: string }>
  >([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState("");
  const [side, setSide] = useState<"LONG" | "SHORT">("LONG");

  const refresh = useCallback(async () => {
    try {
      const next = await fetchMonitor(token);
      setSnap(next);
      setError(null);
      if (token) {
        try {
          const ev = await fetchMonitorEvents(token, 12);
          setEvents(ev.events);
        } catch {
          /* events require auth / migration */
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [token]);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh(), 8_000);
    return () => window.clearInterval(id);
  }, [refresh]);

  async function onAdd(e: FormEvent) {
    e.preventDefault();
    const t = draft.trim().toUpperCase();
    if (!t) return;
    setBusy(true);
    try {
      const next = await addMonitorSymbol(t, side, token);
      setSnap(next);
      setDraft("");
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function onRemove(symbol: string) {
    setBusy(true);
    try {
      const next = await removeMonitorSymbol(symbol, token);
      setSnap(next);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function loadDefaultSix() {
    setBusy(true);
    try {
      const next = await loadDefaultMonitorWatchlist(token);
      setSnap(next);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function onForceTick() {
    setBusy(true);
    try {
      const next = await forceMonitorTick(token);
      setSnap(next);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  const ordered = mergeMonitorRows(snap);
  const planCap = plan?.maxWatchlist ?? snap?.maxSymbols ?? 6;
  const planNote =
    signedIn && ordered.length >= planCap
      ? `Watchlist full (${planCap} symbols on your plan). Remove one to add another.`
      : null;

  return (
    <div className="page">
      <PageHeader
        title="Watchlist"
        subtitle="Live monitor — each card is a full scan (price, indicators, levels, action). Signals only."
        actions={
          <>
            <span className="badge">{snap?.running ? "Watching" : "Paused"}</span>
            <button type="button" className="btn" disabled={busy} onClick={() => void loadDefaultSix()}>
              Load default six
            </button>
            <button type="button" className="btn primary" disabled={busy} onClick={() => void onForceTick()}>
              Scan now
            </button>
            <button type="button" className="btn" disabled={busy} onClick={() => void refresh()}>
              Refresh
            </button>
          </>
        }
      />

      {configured && !signedIn ? (
        <p className="banner warn" role="status" style={{ marginBottom: "0.75rem" }}>
          Sign in to save and scan your watchlist. Without an account, adds will not persist.{" "}
          <Link to="/login">Sign in</Link>
        </p>
      ) : null}

      {planNote ? (
        <p className="muted" style={{ margin: "0 0 0.65rem", fontSize: "0.88rem" }}>
          {planNote}
        </p>
      ) : null}

      <form className="scan-controls" onSubmit={onAdd} style={{ marginBottom: "0.85rem" }}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value.toUpperCase())}
          placeholder="Add symbol"
          maxLength={8}
          style={{
            border: "1px solid var(--border)",
            background: "var(--surface)",
            borderRadius: 8,
            padding: "0.55rem 0.7rem",
            fontFamily: "var(--mono)",
          }}
        />
        <select
          value={side}
          onChange={(e) => setSide(e.target.value as "LONG" | "SHORT")}
          style={{
            border: "1px solid var(--border)",
            background: "var(--surface)",
            borderRadius: 8,
            padding: "0.55rem 0.7rem",
            fontFamily: "var(--mono)",
          }}
        >
          <option value="LONG">LONG</option>
          <option value="SHORT">SHORT</option>
        </select>
        <button type="submit" className="btn primary" disabled={busy}>
          Add
        </button>
      </form>

      {error ? <p className="error-banner" style={{ marginBottom: "0.75rem" }}>{error}</p> : null}

      <div className="panel" style={{ marginBottom: "1rem" }}>
        <h2 style={{ fontSize: "0.95rem", margin: "0 0 0.65rem" }}>
          Monitored setups ({ordered.length}/{snap?.maxSymbols ?? 6})
        </h2>
        {ordered.length === 0 ? (
          <p className="page-sub" style={{ margin: 0 }}>
            No symbols yet. Add a ticker, or load the starter list (TSLA, MU, NVDA, AMD, SPY, QQQ).
          </p>
        ) : (
          <div style={{ display: "grid", gap: "0.65rem" }}>
            {ordered.map((row) => (
              <MonitorCard
                key={row.symbol}
                row={row}
                onOpen={() => openSymbol(row.symbol, { side: row.side, brief: true })}
                onRemove={() => void onRemove(row.symbol)}
                busy={busy}
              />
            ))}
          </div>
        )}
      </div>

      {events.length > 0 ? (
        <div className="panel">
          <h2 style={{ fontSize: "0.95rem", margin: "0 0 0.65rem" }}>
            Recent changes
          </h2>
          <table className="wulu-data-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Symbol</th>
                <th>Change</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {events.map((ev) => (
                <tr key={ev.id}>
                  <td>{formatEtTime(ev.eventAt)}</td>
                  <td>{ev.symbol}</td>
                  <td>{formatMonitorEventChange(ev.previousStatus, ev.newStatus)}</td>
                  <td>
                    {formatMonitorEventReason(ev.previousStatus, ev.newStatus, ev.reason)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

function MonitorCard({
  row,
  onOpen,
  onRemove,
  busy,
}: {
  row: MonitorSymbolState;
  onOpen: () => void;
  onRemove: () => void;
  busy: boolean;
}) {
  const [open, setOpen] = useState(false);
  const scanning = row.statusLabel === "SCANNING" || row.status === "SCANNING";
  const indicators = row.indicatorChecklist ?? [];
  const action = scanning ? "WAIT" : (row.tradingAction ?? "WAIT");

  return (
    <article
      className={`watch-card ${row.dataFresh && !scanning ? "" : "watch-card-stale"}`}
    >
      <div className="watch-card-top">
        <strong className="watch-card-symbol">
          {row.symbol}
          <span className="watch-card-side">{row.side}</span>
        </strong>
        <span className={`badge action-${action.toLowerCase()}`}>{action}</span>
        <StatusBadge status={row.statusLabel || row.status} />
      </div>
      <p className="watch-card-price-line">
        Price {fmtPrice(row.lastPrice)}
        {row.dataFresh ? " · verified" : " · not verified"}
        {" · "}
        Data {fmtDataTime(row.marketDataAt ?? row.evaluatedAt)}
        {row.feed ? ` · ${row.feed.toUpperCase()}` : ""}
      </p>
      {!row.dataFresh && row.dataFreshReason ? (
        <p className="watch-card-fresh-reason">{row.dataFreshReason}</p>
      ) : null}
      {row.watchingSummary ? (
        <p className="watch-card-watching watch-card-lead">{row.watchingSummary}</p>
      ) : null}
      {row.entryGeometrySummary ? (
        <p className="watch-card-waiting">{row.entryGeometrySummary}</p>
      ) : null}
      {row.quoteSpreadPct != null && row.quoteSpreadPct > 0.35 ? (
        <p className="watch-card-fresh-reason">
          Quote spread {row.quoteSpreadPct.toFixed(2)}% — liquidity filter uses bid/ask; setup price may
          use last RTH bar when the quote is not usable.
        </p>
      ) : null}
      {!scanning && row.waitingFor[0] ? (
        <p className="watch-card-waiting">
          <b>Still need:</b> {row.waitingFor.slice(0, 3).join(" · ")}
        </p>
      ) : null}
      {row.error ? <p className="watch-card-error">{row.error}</p> : null}

      {!row.error && !scanning ? (
        <div className="watch-card-levels watch-card-levels-full">
          <span>
            <b>R:R</b>
            {row.rewardToRisk != null ? `${row.rewardToRisk.toFixed(2)}R` : "—"}
          </span>
          <span>
            <b>Score</b>
            {row.qualityScore10 ?? row.setupScore ?? "—"}/10
          </span>
          <span>
            <b>Trigger</b>
            {fmtPrice(row.alertAt)}
          </span>
          <span>
            <b>Entry</b>
            {row.entryZone
              ? `${fmtPrice(row.entryZone.low)}–${fmtPrice(row.entryZone.high)}`
              : "—"}
          </span>
          <span>
            <b>Stop</b>
            {fmtPrice(row.stop)}
          </span>
          <span>
            <b>T1</b>
            {fmtPrice(row.t1)}
          </span>
          <span>
            <b>T2</b>
            {fmtPrice(row.t2)}
          </span>
          <span>
            <b>T3</b>
            {fmtPrice(row.target3)}
          </span>
        </div>
      ) : null}

      {indicators.length > 0 ? (
        <ul className="watch-card-indicators-compact" aria-label="Indicator checklist">
          {indicators.map((ind) => (
            <li key={ind.id}>
              {ind.label}: <strong>{ind.bias}</strong>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="watch-card-actions">
        <button type="button" className="btn primary" onClick={onOpen}>
          Open chart
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          {open ? "Hide detail" : "More detail"}
        </button>
        <button type="button" className="btn" disabled={busy} onClick={() => onRemove()}>
          Remove
        </button>
      </div>

      {open ? (
        <div className="watch-card-detail">
          <ul className="signal-checklist">
            {(row.indicatorChecklist ?? []).map((ind) => (
              <li key={ind.id} className={`check-${ind.bias.toLowerCase().replace(/\s+/g, "-")}`}>
                <strong>{ind.label}</strong>
                <span className={`ind-bias ind-bias-${ind.bias.toLowerCase().replace(/\s+/g, "-")}`}>
                  {ind.bias}
                </span>
                <p>{ind.explanation}</p>
              </li>
            ))}
            {(row.indicatorChecklist ?? []).length === 0 && (
              <li>Indicator checklist will appear after the next monitor scan.</li>
            )}
          </ul>
        </div>
      ) : null}
    </article>
  );
}
