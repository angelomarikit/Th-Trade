import { useCallback, useEffect, useState, type FormEvent } from "react";
import { PageHeader } from "../components/ui/PageHeader";
import { StatusBadge } from "../components/ui/StatusBadge";
import { useAuth } from "../context/AuthContext";
import { useOpenSymbol } from "../hooks/useOpenSymbol";
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

export function WatchlistPage() {
  const { session } = useAuth();
  const openSymbol = useOpenSymbol();
  const token = session?.access_token ?? null;

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

  const statesBySymbol = new Map((snap?.states ?? []).map((s) => [s.symbol, s]));
  const ordered: MonitorSymbolState[] =
    snap?.ranked.map((r) => statesBySymbol.get(r.symbol)).filter((s): s is MonitorSymbolState => !!s) ??
    snap?.states ??
    [];

  return (
    <div className="page">
      <PageHeader
        title="Watchlist"
        subtitle="Stocks you are watching. Open a symbol to see its chart, entry, stop, and targets. Alerts are signals only — nothing is sent to a broker."
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
          Ranked opportunities ({ordered.length}/{snap?.maxSymbols ?? 6})
        </h2>
        {ordered.length === 0 ? (
          <p className="page-sub" style={{ margin: 0 }}>
            No symbols yet. Add a ticker, or load the starter list (TSLA, MU, NVDA, AMD, SPY, QQQ).
            Sign in to keep this list on your account.
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
                  <td>
                    {ev.previousStatus} → {ev.newStatus}
                  </td>
                  <td>{ev.reason}</td>
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
  return (
    <article
      className="panel"
      style={{ cursor: "pointer", margin: 0, padding: "0.75rem 0.9rem" }}
      onClick={onOpen}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", flexWrap: "wrap" }}>
        <strong style={{ fontFamily: "var(--mono)" }}>
          {row.symbol} — {row.side}
        </strong>
        <StatusBadge status={row.status} />
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: "0.35rem 0.75rem",
          marginTop: "0.55rem",
          fontSize: "0.82rem",
          fontFamily: "var(--mono)",
        }}
      >
        <span>Price: {fmtPrice(row.lastPrice)}</span>
        <span>Chg: {fmtPct(row.pctChange)}</span>
        <span>Trigger: {fmtPrice(row.alertAt)}</span>
        <span>
          Entry:{" "}
          {row.entryZone
            ? `${fmtPrice(row.entryZone.low)}–${fmtPrice(row.entryZone.high)}`
            : "—"}
        </span>
        <span>Stop: {fmtPrice(row.stop)}</span>
        <span>Target 1: {fmtPrice(row.t1)}</span>
        <span>Target 2: {fmtPrice(row.t2)}</span>
        <span>
          Reward / risk:{" "}
          {row.rewardToRisk != null ? `${row.rewardToRisk.toFixed(2)}R` : "—"}
        </span>
        <span>Volume: {row.rvol != null ? `${row.rvol.toFixed(2)}x` : "—"}</span>
        {!row.dataFresh ? <span>Price check: not verified</span> : null}
      </div>
      {row.actionHint ? (
        <p style={{ margin: "0.45rem 0 0", fontSize: "0.82rem", fontWeight: 600 }}>
          Action: {row.actionHint}
        </p>
      ) : null}
      {!row.dataFresh ? (
        <p style={{ margin: "0.45rem 0 0", fontSize: "0.8rem", color: "var(--danger, #c44)" }}>
          DATA NOT VERIFIED — no trade from this row until the price check passes.
        </p>
      ) : null}
      {row.waitingFor.length > 0 ? (
        <p style={{ margin: "0.45rem 0 0", fontSize: "0.8rem", opacity: 0.85 }}>
          Waiting: {row.waitingFor.slice(0, 3).join(" · ")}
        </p>
      ) : null}
      {row.error ? (
        <p style={{ margin: "0.35rem 0 0", fontSize: "0.8rem", color: "var(--danger, #c44)" }}>
          {row.error}
        </p>
      ) : null}
      <div style={{ marginTop: "0.5rem" }}>
        <button
          type="button"
          className="btn"
          disabled={busy}
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
        >
          Remove
        </button>
      </div>
    </article>
  );
}
