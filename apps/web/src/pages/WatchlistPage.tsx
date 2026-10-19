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

/** A missing bar used to throw inside the scan and land on the card as a JS error. */
function missingBarCrash(error: string | null | undefined): boolean {
  if (!error) return false;
  return /cannot read properties of undefined/i.test(error) || /reading ['"]close['"]/i.test(error) || /price check failed/i.test(error);
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
  const serverCapacity = snap?.maxSymbols ?? 12;
  const planLimit = snap?.planMax ?? plan?.maxWatchlist ?? null;
  const planCap = planLimit ?? serverCapacity;
  const planNote =
    signedIn && planLimit != null && ordered.length >= planLimit
      ? `Plan limit reached (${planLimit} symbols). Remove one to add another.`
      : null;
  const limitNote =
    planLimit != null && planLimit !== serverCapacity
      ? `Plan limit is ${planLimit} symbols. Preview server capacity is ${serverCapacity}. The count below uses server capacity.`
      : planLimit != null
        ? `Plan limit and server capacity are both ${planLimit} symbols.`
        : `Preview server capacity is ${serverCapacity} symbols.`;

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
      <p className="page-sub" style={{ margin: "0 0 0.75rem" }}>{limitNote}</p>

      <div className="panel" style={{ marginBottom: "1rem" }}>
        <h2 style={{ fontSize: "0.95rem", margin: "0 0 0.65rem" }}>
          Monitored setups ({ordered.length}/{serverCapacity} server capacity)
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
          <h2 style={{ fontSize: "0.95rem", margin: "0 0 0.35rem" }}>
            Meaningful alerts
          </h2>
          <p className="muted" style={{ margin: "0 0 0.65rem", fontSize: "0.82rem" }}>
            Near active, entry active, missed, invalidated, target hit, or stop hit — not routine WAIT
            churn.
          </p>
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

function sessionPriceHint(session: string | null, dataFresh: boolean): string {
  const s = (session ?? "").toUpperCase();
  if (s.includes("PRE")) return "Premarket · chart context only";
  if (!dataFresh) return "Not verified · no entry permission";
  return "Verified live";
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
  const action = scanning ? "WAIT" : (row.tradingAction ?? "WAIT");
  const waitingLine =
    !scanning && row.waitingFor[0]
      ? row.waitingFor[0]
      : !scanning && row.watchingSummary
        ? row.watchingSummary
        : null;

  return (
    <article
      className={`watch-card watch-card-compact ${row.dataFresh && !scanning ? "" : "watch-card-stale"}`}
    >
      <div className="watch-card-top">
        <strong className="watch-card-symbol">
          {row.symbol}
          <span className="watch-card-side">{row.side}</span>
        </strong>
        <div className="watch-card-badges">
          <span className={`badge action-${action.toLowerCase()}`}>{action}</span>
          <StatusBadge status={missingBarCrash(row.error) ? "DATA NOT VERIFIED" : row.statusLabel || row.status} />
        </div>
      </div>

      <p className="watch-card-price-line watch-card-price-compact">
        <span className="watch-card-price">{fmtPrice(row.lastPrice)}</span>
        <span className="watch-card-session-hint">{sessionPriceHint(row.session, row.dataFresh)}</span>
      </p>

      {!scanning && waitingLine ? (
        <p className="watch-card-waiting watch-card-waiting-oneline">
          <b>Waiting for:</b> {waitingLine}
        </p>
      ) : null}

      {row.error && !missingBarCrash(row.error) ? <p className="watch-card-error">{row.error}</p> : null}
      {missingBarCrash(row.error) ? (
        <p className="watch-card-waiting watch-card-waiting-oneline">
          <b>DATA NOT VERIFIED</b> — no completed price bar for this symbol. No trade from this card.
        </p>
      ) : null}

      {(!row.error || missingBarCrash(row.error)) && !scanning ? (
        <div className="watch-card-levels watch-card-levels-grid">
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

      <div className="watch-card-actions">
        <button type="button" className="btn primary" onClick={onOpen}>
          Chart
        </button>
        <button
          type="button"
          className="btn"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          {open ? "Hide" : "Details"}
        </button>
        <button type="button" className="btn" disabled={busy} onClick={() => onRemove()}>
          Remove
        </button>
      </div>

      {open ? (
        <div className="watch-card-detail">
          <p className="muted">
            Data {fmtDataTime(row.marketDataAt ?? row.evaluatedAt)}
            {row.feed ? ` · ${row.feed.toUpperCase()}` : ""}
            {row.rewardToRisk != null ? ` · ${row.rewardToRisk.toFixed(2)}R` : ""}
            {" · Score "}
            {row.qualityScore10 ?? row.setupScore ?? "—"}/10
          </p>
          {row.watchingSummary ? <p>{row.watchingSummary}</p> : null}
          {!row.dataFresh && row.dataFreshReason ? <p>{row.dataFreshReason}</p> : null}
          {row.entryGeometrySummary ? <p>{row.entryGeometrySummary}</p> : null}
          {row.quoteSpreadPct != null && row.quoteSpreadPct > 0.35 ? (
            <p>
              Quote spread {row.quoteSpreadPct.toFixed(2)}% — wide spread may block ENTER until bid/ask
              tighten or RTH bar reference is used.
            </p>
          ) : null}
          {row.waitingFor.length > 1 ? (
            <p>
              <b>Also watching:</b> {row.waitingFor.slice(1, 4).join(" · ")}
            </p>
          ) : null}
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
