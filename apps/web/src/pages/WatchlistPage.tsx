import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTerminal } from "../context/TerminalContext";
import {
  addMonitorSymbol,
  fetchMonitor,
  forceMonitorTick,
  removeMonitorSymbol,
  setMonitorWatchlist,
  type MonitorSnapshot,
  type MonitorSymbolState,
} from "../lib/api";
import { fmtPrice } from "../lib/format";

const DEFAULT_SIX = ["TSLA", "MU", "NVDA", "AMD", "SPY", "QQQ"];

export function WatchlistPage() {
  const { session } = useAuth();
  const { selectSymbol } = useTerminal();
  const navigate = useNavigate();
  const token = session?.access_token ?? null;

  const [snap, setSnap] = useState<MonitorSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState("");
  const [side, setSide] = useState<"LONG" | "SHORT">("LONG");

  const refresh = useCallback(async () => {
    try {
      const next = await fetchMonitor(token);
      setSnap(next);
      setError(null);
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
      const next = await setMonitorWatchlist(
        DEFAULT_SIX.map((symbol) => ({ symbol, side: "LONG" as const })),
        token,
      );
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
      <h1 className="page-title">Live Monitor</h1>
      <p className="page-sub">
        Server-side multi-stock monitoring (Step 2). Up to {snap?.maxSymbols ?? 6} symbols scanned
        about every {Math.round((snap?.intervalMs ?? 20_000) / 1000)}s on the API — the browser does
        not need to stay open for scans to continue.
      </p>

      <div className="scan-controls" style={{ marginBottom: "0.85rem", flexWrap: "wrap", gap: "0.5rem" }}>
        <span
          className="status-pill"
          style={{
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: "0.45rem 0.7rem",
            fontFamily: "var(--mono)",
            fontSize: "0.8rem",
          }}
        >
          {snap?.running ? "RUNNING" : "IDLE"} · ticks {snap?.tickCount ?? 0}
          {snap?.lastTickAt ? ` · last ${new Date(snap.lastTickAt).toLocaleTimeString()}` : ""}
        </span>
        <button type="button" className="scan-btn" disabled={busy} onClick={() => void loadDefaultSix()}>
          Load TSLA / MU / NVDA / AMD / SPY / QQQ
        </button>
        <button type="button" className="scan-btn" disabled={busy} onClick={() => void onForceTick()}>
          Scan now
        </button>
        <button type="button" className="icon-btn" disabled={busy} onClick={() => void refresh()}>
          Refresh
        </button>
      </div>

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
        <button type="submit" className="scan-btn" disabled={busy}>
          Add to monitor
        </button>
      </form>

      {error ? (
        <p style={{ color: "var(--danger, #c44)", marginBottom: "0.75rem", fontSize: "0.9rem" }}>
          {error}
        </p>
      ) : null}

      {snap?.note ? (
        <p className="page-sub" style={{ marginTop: 0 }}>
          {snap.note}
        </p>
      ) : null}

      <div className="panel" style={{ marginBottom: "1rem" }}>
        <h2 style={{ fontSize: "0.95rem", margin: "0 0 0.65rem" }}>Ranked by setup readiness</h2>
        {ordered.length === 0 ? (
          <p className="page-sub" style={{ margin: 0 }}>
            No symbols monitored yet. Load the default six or add tickers above.
          </p>
        ) : (
          <div style={{ display: "grid", gap: "0.65rem" }}>
            {ordered.map((row) => (
              <MonitorCard
                key={row.symbol}
                row={row}
                onOpen={() => {
                  selectSymbol(row.symbol, { brief: true });
                  navigate("/scanner");
                }}
                onRemove={() => void onRemove(row.symbol)}
                busy={busy}
              />
            ))}
          </div>
        )}
      </div>

      <div className="panel">
        <h2 style={{ fontSize: "0.95rem", margin: "0 0 0.65rem" }}>Watchlist ({snap?.symbols.length ?? 0}/{snap?.maxSymbols ?? 6})</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Symbol</th>
              <th>Side</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {(snap?.symbols ?? []).map((s) => {
              const st = statesBySymbol.get(s.symbol);
              return (
                <tr key={s.symbol}>
                  <td>{s.symbol}</td>
                  <td>{s.side}</td>
                  <td>{st?.status ?? "…"}</td>
                  <td>
                    <button
                      type="button"
                      className="icon-btn"
                      disabled={busy}
                      onClick={() => void onRemove(s.symbol)}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
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
      style={{
        border: "1px solid var(--border)",
        borderRadius: 10,
        padding: "0.75rem 0.9rem",
        background: "var(--surface)",
        cursor: "pointer",
      }}
      onClick={onOpen}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem", flexWrap: "wrap" }}>
        <strong style={{ fontFamily: "var(--mono)" }}>
          {row.symbol} — {row.side}
        </strong>
        <span style={{ fontFamily: "var(--mono)", fontSize: "0.85rem" }}>{row.status}</span>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
          gap: "0.35rem 0.75rem",
          marginTop: "0.55rem",
          fontSize: "0.85rem",
          fontFamily: "var(--mono)",
        }}
      >
        <span>Price: {fmtPrice(row.lastPrice)}</span>
        <span>Trigger: {fmtPrice(row.alertAt)}</span>
        <span>
          Entry:{" "}
          {row.entryZone
            ? `${fmtPrice(row.entryZone.low)}–${fmtPrice(row.entryZone.high)}`
            : "—"}
        </span>
        <span>Stop: {fmtPrice(row.stop)}</span>
        <span>T1: {fmtPrice(row.t1)}</span>
        <span>T2: {fmtPrice(row.t2)}</span>
        <span>
          Quality: {row.setupScore != null ? `${row.setupScore}/100` : "—"}
        </span>
        <span>
          Conditions: {row.conditionsPassed}/{row.conditionsTotal}
        </span>
        <span>{row.distanceLabel ?? ""}</span>
        <span>{row.dataFresh ? "Data fresh" : "DATA NOT VERIFIED"}</span>
      </div>
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
          className="icon-btn"
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
