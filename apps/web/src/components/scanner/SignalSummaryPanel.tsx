import { useState } from "react";
import { StatusBadge, normalizeStatus } from "../ui/StatusBadge";
import { useTerminal } from "../../context/TerminalContext";
import { fmtPct, fmtPrice } from "../../lib/format";

/**
 * Chart-first companion: direction, status, levels, R:R, plain-English wait reason.
 * Details stay collapsed. Does not change confirmation gates.
 */
export function SignalSummaryPanel() {
  const { data, symbol, side, setSide, scan, loading, toggleWatchlist, watchlist } = useTerminal();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const lc = data?.liveCard;
  const starred = watchlist.includes(symbol);

  if (!lc) {
    return (
      <aside className="signal-panel panel">
        <p className="muted" style={{ margin: 0 }}>
          {loading ? "Loading setup…" : "Search a symbol to load chart and analysis."}
        </p>
      </aside>
    );
  }

  const status = normalizeStatus(lc.status);
  const waiting =
    lc.nearActive?.stillWaitingFor?.length
      ? lc.nearActive.stillWaitingFor
      : lc.waitingFor ?? [];
  const whyWait =
    status.includes("WAIT") || status.includes("NO TRADE") || status.includes("NEAR")
      ? waiting[0] ??
        lc.nearActive?.confirmationRequirement ??
        "Waiting for confirmation conditions to clear."
      : status.includes("ENTRY")
        ? "Entry conditions are active on this setup — still not an automatic order."
        : waiting[0] ?? lc.nearActive?.confirmationRequirement ?? "See details for checklist.";

  const rr = lc.rewardToRisk;
  const score = lc.setupScoreValue ?? "—";
  const session = lc.session?.session ?? "—";

  return (
    <aside className="signal-panel panel">
      <div className="signal-panel-market">
        <span className="badge">{session}</span>
        <span className={`badge ${lc.dataFresh ? "green" : "amber"}`}>
          DATA {lc.dataFresh ? "FRESH" : "STALE"}
        </span>
      </div>

      <div className="signal-panel-dir">
        <div className="side-toggle" role="group" aria-label="Direction">
          <button
            type="button"
            className={`buy ${side === "LONG" ? "active" : ""}`}
            onClick={() => {
              setSide("LONG");
              void scan({ ticker: symbol, side: "LONG", brief: false });
            }}
          >
            LONG
          </button>
          <button
            type="button"
            className={`sell ${side === "SHORT" ? "active" : ""}`}
            onClick={() => {
              setSide("SHORT");
              void scan({ ticker: symbol, side: "SHORT", brief: false });
            }}
          >
            SHORT
          </button>
        </div>
        <StatusBadge status={status} className="signal-status" />
      </div>

      <dl className="signal-levels">
        <div>
          <dt>Entry trigger</dt>
          <dd>{fmtPrice(lc.alertAt)}</dd>
        </div>
        <div>
          <dt>Stop</dt>
          <dd>{fmtPrice(lc.stop)}</dd>
        </div>
        <div>
          <dt>Target 1</dt>
          <dd>{fmtPrice(lc.t1)}</dd>
        </div>
        <div>
          <dt>Target 2</dt>
          <dd>{fmtPrice(lc.t2)}</dd>
        </div>
        <div>
          <dt>Reward : Risk</dt>
          <dd>{rr != null && Number.isFinite(rr) ? `${rr.toFixed(2)}R` : "—"}</dd>
        </div>
        <div>
          <dt>Setup score</dt>
          <dd title={lc.setupScoreDisclaimer}>
            {score}/100
            <span className="decision-muted"> · not win %</span>
          </dd>
        </div>
      </dl>

      <div className="signal-why">
        <h3>Why WULU says {status.includes("ENTRY") ? "ENTRY" : status.includes("NO") ? "NO TRADE" : "WAIT"}</h3>
        <p>{whyWait}</p>
        <p className="disclaimer">
          Signals only — automatic trading disabled. Min ~2R and confirmation gates unchanged.
        </p>
      </div>

      <button
        type="button"
        className="scan-btn signal-watch-btn"
        onClick={() => toggleWatchlist(symbol)}
      >
        {starred ? "Remove from watchlist" : "Add to watchlist"}
      </button>

      <button
        type="button"
        className="decision-section-toggle"
        onClick={() => setDetailsOpen((v) => !v)}
      >
        {detailsOpen ? "▾" : "▸"} Confirmation details
      </button>
      {detailsOpen && (
        <div className="decision-section-body">
          <p>
            Checklist {lc.conditionsPassed ?? "—"} / {lc.conditionsTotal ?? "—"}
          </p>
          <ul>
            {waiting.slice(0, 8).map((w) => (
              <li key={w}>{w}</li>
            ))}
            {waiting.length === 0 && <li>No open waiting conditions.</li>}
          </ul>
          {lc.relativeMomentum && (
            <p className="muted">
              RVOL{" "}
              {lc.relativeMomentum.rvol != null
                ? `${lc.relativeMomentum.rvol.toFixed(2)}x`
                : "—"}{" "}
              · vs SPY {fmtPct(lc.relativeMomentum.vsSpyPct)} · VWAP{" "}
              {lc.relativeMomentum.vwapLocation}
            </p>
          )}
        </div>
      )}
    </aside>
  );
}
