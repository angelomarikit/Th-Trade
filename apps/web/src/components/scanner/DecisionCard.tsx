import { useState } from "react";
import { useTerminal } from "../../context/TerminalContext";
import { fmtPct, fmtPrice } from "../../lib/format";

/**
 * Mobile-first decision card — readable STATUS / levels / expandable context.
 * Setup score is never labeled as win probability.
 */
export function DecisionCard() {
  const { data, symbol, side } = useTerminal();
  const [open, setOpen] = useState<Record<string, boolean>>({
    checklist: true,
    news: false,
    market: false,
    edge: false,
  });

  const lc = data?.liveCard;
  if (!lc) {
    return (
      <section className="panel decision-card">
        <p className="disclaimer" style={{ margin: 0 }}>
          Run a Scan to populate the decision card.
        </p>
      </section>
    );
  }

  const na = lc.nearActive;
  const rm = lc.relativeMomentum;
  const status = lc.status;
  const score = lc.setupScoreValue ?? "—";

  function toggle(key: string) {
    setOpen((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  return (
    <section className="panel decision-card">
      <div className="decision-card-head">
        <h2>
          {symbol} — {side}
        </h2>
        <span className={`badge ${statusBadge(status)}`}>{normalizeStatus(status)}</span>
      </div>

      <dl className="decision-grid">
        <div>
          <dt>STATUS</dt>
          <dd className={statusBadge(status)}>{normalizeStatus(status)}</dd>
        </div>
        <div>
          <dt>CURRENT PRICE</dt>
          <dd>{fmtPrice(lc.lastPrice)}</dd>
        </div>
        <div className="span-2">
          <dt>WHY MOVING</dt>
          <dd>{lc.whyMoving || "—"}</dd>
        </div>
        <div>
          <dt>ALERT AT</dt>
          <dd>{fmtPrice(lc.alertAt)}</dd>
        </div>
        <div>
          <dt>DISTANCE</dt>
          <dd>{na?.distanceLabel ?? "—"}</dd>
        </div>
        <div className="span-2">
          <dt>CONFIRMATION</dt>
          <dd className="decision-muted">
            {lc.conditionsPassed ?? "—"} / {lc.conditionsTotal ?? "—"} passed
            {na?.active ? " · NEAR ACTIVE (not entry)" : ""}
          </dd>
        </div>
        <div className="span-2">
          <dt>ENTRY ZONE</dt>
          <dd>
            {fmtPrice(lc.entryZone.low)}–{fmtPrice(lc.entryZone.high)}
            {lc.entryZone.executable ? "" : " (not executable)"}
          </dd>
        </div>
        <div>
          <dt>STOP</dt>
          <dd>{fmtPrice(lc.stop)}</dd>
        </div>
        <div>
          <dt>TARGET 1</dt>
          <dd>{fmtPrice(lc.t1)}</dd>
        </div>
        <div>
          <dt>TARGET 2</dt>
          <dd>{fmtPrice(lc.t2)}</dd>
        </div>
        <div>
          <dt>SETUP SCORE</dt>
          <dd title={lc.setupScoreDisclaimer}>
            {score}/100
            <span className="decision-muted"> · not win probability</span>
          </dd>
        </div>
      </dl>

      {na && (
        <p className="disclaimer decision-gate">{na.confirmationRequirement}</p>
      )}

      <div className="decision-sections">
        <button type="button" className="decision-section-toggle" onClick={() => toggle("checklist")}>
          {open.checklist ? "▾" : "▸"} Entry checklist & chart guide
        </button>
        {open.checklist && (
          <div className="decision-section-body">
            <ul>
              {(na?.stillWaitingFor?.length ? na.stillWaitingFor : lc.waitingFor).map((w) => (
                <li key={w}>{w}</li>
              ))}
              {!(na?.stillWaitingFor?.length || lc.waitingFor.length) && (
                <li>No open waiting conditions on the current matrix.</li>
              )}
            </ul>
            <p className="disclaimer">
              Chart: watch completed 5-minute closes relative to alert {fmtPrice(lc.alertAt)}. Trigger
              touch ≠ entry.
            </p>
          </div>
        )}

        <button type="button" className="decision-section-toggle" onClick={() => toggle("news")}>
          {open.news ? "▾" : "▸"} News & catalyst
        </button>
        {open.news && (
          <div className="decision-section-body">
            <p>
              <strong>NEWS CATALYST:</strong> {lc.catalyst ?? "None verified"}
            </p>
            <p>
              <strong>NEWS TIME:</strong>{" "}
              {lc.newsAgeMinutes != null ? `${lc.newsAgeMinutes} min ago` : "—"}
            </p>
            <p>
              <strong>MARKET REACTION:</strong> {lc.priceReaction ?? "UNKNOWN"}
            </p>
            <p className="disclaimer">
              A bullish headline never independently activates a long. Confirmed price action controls
              execution.
            </p>
          </div>
        )}

        <button type="button" className="decision-section-toggle" onClick={() => toggle("market")}>
          {open.market ? "▾" : "▸"} Market / sector comparison
        </button>
        {open.market && (
          <div className="decision-section-body">
            {rm ? (
              <>
                <div className="metric-grid">
                  <div>
                    <label>vs SPY</label>
                    <strong>{fmtSigned(rm.vsSpyPct)}</strong>
                  </div>
                  <div>
                    <label>vs QQQ</label>
                    <strong>{fmtSigned(rm.vsQqqPct)}</strong>
                  </div>
                  <div>
                    <label>{rm.sectorEtf}</label>
                    <strong>{fmtSigned(rm.vsSectorPct)}</strong>
                  </div>
                  <div>
                    <label>RVOL</label>
                    <strong>{rm.rvol != null ? `${rm.rvol.toFixed(2)}x` : "—"}</strong>
                  </div>
                  <div>
                    <label>VWAP</label>
                    <strong>{rm.vwapLocation}</strong>
                  </div>
                  <div>
                    <label>Trend</label>
                    <strong>{rm.intradayTrend}</strong>
                  </div>
                  <div>
                    <label>Rank score</label>
                    <strong>{rm.rankScore}</strong>
                  </div>
                  <div>
                    <label>Feed</label>
                    <strong>{rm.feed.toUpperCase()}</strong>
                  </div>
                </div>
                <ul>
                  {rm.notes.map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                </ul>
                <p className="disclaimer">{rm.feedLimitation}</p>
              </>
            ) : (
              <p className="disclaimer">Relative momentum unavailable for this scan.</p>
            )}
            <p className="disclaimer">
              Market: {lc.market ?? "—"} · Regime: {lc.marketRegime ?? "—"}
            </p>
          </div>
        )}

        <button type="button" className="decision-section-toggle" onClick={() => toggle("edge")}>
          {open.edge ? "▾" : "▸"} Historical statistics
        </button>
        {open.edge && (
          <div className="decision-section-body">
            {lc.historicalEdge && lc.historicalEdge.sampleSize > 0 ? (
              <>
                <p>{lc.historicalEdge.collapsedSummary}</p>
                <p className="disclaimer">{lc.historicalEdge.disclaimer}</p>
              </>
            ) : (
              <p className="disclaimer">No validated historical edge sample for this setup.</p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function normalizeStatus(status: string): string {
  const u = status.toUpperCase();
  if (u.includes("ENTRY ACTIVE")) return u.includes("SHORT") ? "ENTRY ACTIVE" : "ENTRY ACTIVE";
  if (u.includes("NEAR ACTIVE")) return "NEAR ACTIVE";
  if (u.includes("MISSED")) return "MISSED";
  if (u.includes("INVALIDATED")) return "INVALIDATED";
  if (u.includes("DATA NOT VERIFIED") || u.includes("DATA_NOT")) return "DATA NOT VERIFIED";
  if (u.includes("NO TRADE") || u.includes("NO_TRADE")) return "NO TRADE";
  if (u.includes("WAIT")) return "WAIT";
  return status;
}

function statusBadge(status: string): string {
  const u = status.toUpperCase();
  if (u.includes("ENTRY ACTIVE")) return "green";
  if (u.includes("NEAR ACTIVE")) return "amber";
  if (u.includes("MISSED") || u.includes("INVALIDATED")) return "red";
  if (u.includes("DATA")) return "amber";
  return "";
}

function fmtSigned(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return fmtPct(n);
}
