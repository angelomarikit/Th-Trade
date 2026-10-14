import { useState } from "react";
import { StatusBadge, normalizeStatus } from "../ui/StatusBadge";
import { useTerminal } from "../../context/TerminalContext";
import { fmtPct, fmtPrice } from "../../lib/format";
import { buildTradingBrief, primaryStrategyName } from "../../lib/tradingRecommendation";

/**
 * Primary trading assistant panel — same setup card as chart levels and monitor.
 */
export function SignalSummaryPanel() {
  const { data, symbol, side, setSide, scan, loading, toggleWatchlist, watchlist, displayPrice, bars } =
    useTerminal();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const lc = data?.liveCard;
  const starred = watchlist.includes(symbol);

  if (!lc) {
    return (
      <aside className="signal-panel panel">
        <p className="muted" style={{ margin: 0 }}>
          {loading ? "Loading setup…" : "Search a symbol to load chart and trading recommendation."}
        </p>
      </aside>
    );
  }

  const status = normalizeStatus(lc.status);
  const rr = lc.rewardToRisk;
  const score10 = lc.qualityScore10 ?? lc.nearActive?.setupQualityScore ?? null;
  const strat = primaryStrategyName(lc);
  const chartClose =
    bars?.symbol?.toUpperCase() === symbol.toUpperCase() ? bars.bars.at(-1)?.close : null;
  const setupPx = displayPrice ?? lc.lastPrice;
  const setupStale =
    setupPx != null &&
    chartClose != null &&
    Number.isFinite(setupPx) &&
    Number.isFinite(chartClose) &&
    Math.abs(setupPx - chartClose) / Math.max(chartClose, 1e-6) > 0.008;
  const showExecutableLevels = lc.dataFresh && !setupStale;
  const briefLines = buildTradingBrief({ symbol, side, liveCard: lc, displayPrice });
  const indicatorRows =
    (lc.indicatorChecklist?.length ? lc.indicatorChecklist : null) ??
    (lc.matrixChecklist ?? []).map((row) => ({
      id: row.id,
      label: row.label,
      bias:
        row.status === "PASS"
          ? ("BULLISH" as const)
          : row.status === "FAIL"
            ? ("BEARISH" as const)
            : row.status === "WAITING"
              ? ("NEUTRAL" as const)
              : ("NOT VERIFIED" as const),
      explanation: row.reason,
      gateStatus: row.status,
    }));

  return (
    <aside className="signal-panel panel" aria-label="Trading recommendation">
      <div className="signal-panel-market">
        <span className="badge">{lc.session?.session ?? "—"}</span>
        <span className={`badge ${lc.dataFresh ? "green" : "amber"}`}>
          {lc.dataFresh ? "Verified data" : "Not verified"}
        </span>
        <StatusBadge status={status} className="signal-status" />
      </div>

      <div className="signal-action-hero wait">
        <p className="action-label">Direction</p>
        <div className="signal-panel-dir" style={{ margin: 0 }}>
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
        </div>
        <p className="action-value" style={{ marginTop: "0.35rem" }}>
          {status}
        </p>
        <p className="action-label">
          Setup score {score10 != null ? `${score10}/10` : "—"}
          {rr != null && Number.isFinite(rr) ? ` · ${rr.toFixed(2)}R to T1` : ""}
        </p>
        {strat ? <p className="action-label">Strategy: {strat}</p> : null}
      </div>

      <div className="signal-brief" role="status">
        {setupStale ? (
          <p className="muted">Updating setup — entry levels hidden until chart and scan match.</p>
        ) : null}
        {briefLines.map((line) => (
          <p key={line}>{line}</p>
        ))}
      </div>

      {showExecutableLevels ? (
      <dl className="signal-levels">
        <div>
          <dt>Trigger</dt>
          <dd>{fmtPrice(lc.alertAt)}</dd>
        </div>
        <div className="signal-entry-zone">
          <dt>Entry zone</dt>
          <dd>
            {fmtPrice(lc.entryZone.low)} – {fmtPrice(lc.entryZone.high)}
          </dd>
        </div>
        <div>
          <dt>Stop</dt>
          <dd className="level-stop">{fmtPrice(lc.stop)}</dd>
        </div>
        <div>
          <dt>T1</dt>
          <dd className="level-t1">{fmtPrice(lc.t1)}</dd>
        </div>
        <div>
          <dt>T2</dt>
          <dd className="level-t2">{fmtPrice(lc.t2)}</dd>
        </div>
        {lc.t3 != null && (
          <div>
            <dt>T3</dt>
            <dd>{fmtPrice(lc.t3)}</dd>
          </div>
        )}
      </dl>
      ) : (
        <p className="muted" style={{ margin: "0.5rem 0" }}>
          Entry trigger, zone, stop, and targets are hidden until data is verified and aligned with the
          chart.
        </p>
      )}

      <p className="disclaimer">
        Signals only — no orders sent. Entry requires completed 5m confirmation, ~2R, fresh data, and
        full checklist. News never authorizes entry alone.
      </p>

      <button type="button" className="scan-btn signal-watch-btn" onClick={() => toggleWatchlist(symbol)}>
        {starred ? "Remove from watchlist" : "Add to watchlist"}
      </button>

      <button type="button" className="decision-section-toggle" onClick={() => setDetailsOpen((v) => !v)}>
        {detailsOpen ? "▾" : "▸"} Indicator checklist ({lc.conditionsPassed ?? "—"} /{" "}
        {lc.conditionsTotal ?? "—"})
      </button>
      {detailsOpen && (
        <div className="decision-section-body">
          <ul className="signal-checklist">
            {indicatorRows.map((ind) => (
              <li key={ind.id} className={`check-${ind.bias.toLowerCase().replace(/\s+/g, "-")}`}>
                <strong>{ind.label}</strong>
                <span className={`ind-bias ind-bias-${ind.bias.toLowerCase().replace(/\s+/g, "-")}`}>
                  {ind.bias}
                </span>
                <p>{ind.explanation}</p>
              </li>
            ))}
            {!indicatorRows.length &&
              (lc.waitingFor ?? []).map((w) => <li key={w}>{w}</li>)}
          </ul>
          {lc.relativeMomentum && (
            <p className="muted">
              RVOL {lc.relativeMomentum.rvol != null ? `${lc.relativeMomentum.rvol.toFixed(2)}x` : "—"} ·
              vs SPY {fmtPct(lc.relativeMomentum.vsSpyPct)} · VWAP {lc.relativeMomentum.vwapLocation}
            </p>
          )}
          {lc.qualityScore10Disclaimer ? (
            <p className="muted">{lc.qualityScore10Disclaimer}</p>
          ) : null}
        </div>
      )}
    </aside>
  );
}
