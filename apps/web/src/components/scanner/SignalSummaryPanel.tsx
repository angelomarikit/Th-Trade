import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { StatusBadge, normalizeStatus } from "../ui/StatusBadge";
import { useAuth } from "../../context/AuthContext";
import { useTerminal } from "../../context/TerminalContext";
import { addMonitorSymbol, type SetupLiveCard } from "../../lib/api";
import { friendlyApiError } from "../../lib/apiBase";
import { fmtPct, fmtPrice, formatEtTime } from "../../lib/format";
import { SessionPriceBanner } from "../ui/SessionPriceBanner";
import { MarketDataStatusStrip } from "../ui/MarketDataStatusStrip";
import { isSetupChartStale } from "../../lib/setupChartSync";
import { buildTradingBrief, primaryStrategyName } from "../../lib/tradingRecommendation";

/**
 * Primary trading assistant panel — same setup card as chart levels and monitor.
 */
export function SignalSummaryPanel() {
  const { data, symbol, side, setSide, scan, loading, toggleWatchlist, watchlist, displayPrice, bars } =
    useTerminal();
  const { session, configured } = useAuth();
  const navigate = useNavigate();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [watchMsg, setWatchMsg] = useState<string | null>(null);
  const [watchBusy, setWatchBusy] = useState(false);
  const starred = watchlist.includes(symbol);

  if (!data?.liveCard) {
    return (
      <aside className="signal-panel panel">
        <p className="muted" style={{ margin: 0 }}>
          {loading ? "Loading setup…" : "Search a symbol to load chart and trading recommendation."}
        </p>
      </aside>
    );
  }

  const lc: SetupLiveCard = data.liveCard;
  const status = normalizeStatus(lc.status);
  const rr = lc.rewardToRisk;
  const score10 = lc.qualityScore10 ?? lc.nearActive?.setupQualityScore ?? null;
  const strat = primaryStrategyName(lc);
  const chartClose =
    bars?.symbol?.toUpperCase() === symbol.toUpperCase() ? bars.bars.at(-1)?.close : null;
  const setupSymbol = lc.symbol ?? data?.card.symbol ?? null;
  const setupStale = isSetupChartStale({
    symbol,
    setupSymbol,
    barsSymbol: bars?.symbol,
    setupEvaluatedAt: lc.evaluatedAt ?? data?.card.evaluatedAt ?? null,
    loading,
  });
  const planForSymbol =
    setupSymbol != null && setupSymbol.toUpperCase() === symbol.toUpperCase() && !loading;
  const planStale = setupStale || lc.dataFresh === false;
  const entryMid = (lc.entryZone.low + lc.entryZone.high) / 2;
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
      <MarketDataStatusStrip />
      <SessionPriceBanner
        session={lc.session?.session}
        dataFresh={lc.dataFresh !== false}
        referencePriceOnly={lc.quoteTransparency?.referencePriceOnly === true}
      />

      <div className="signal-panel-market">
        <span className="badge">{lc.session?.session ?? "—"}</span>
        <span className={`badge ${lc.dataFresh ? "green" : "amber"}`}>
          {lc.dataFresh ? "Verified data" : "Not verified"}
        </span>
        {lc.quoteTransparency?.referencePriceOnly ? (
          <span className="badge amber" title={lc.quoteTransparency.priceBasis}>
            RTH reference price
          </span>
        ) : null}
        <StatusBadge status={status} className="signal-status" />
      </div>

      <div className={`signal-action-hero ${(lc.tradingAction ?? "WAIT").toLowerCase()}`}>
        <p className="action-value">{lc.tradingAction ?? "WAIT"}</p>
        <p className="action-label">{status}</p>
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
      </div>

      {setupStale ? (
        <p className="muted signal-scan-note">Refreshing scan — values below update with each evaluation.</p>
      ) : null}
      {lc.evaluatedAt ? (
        <p className="muted signal-scan-note">
          Scan {formatEtTime(lc.evaluatedAt)}
          {planStale ? " · reference / not entry permission" : " · verified evaluation"}
        </p>
      ) : null}

      {planForSymbol ? (
        <dl className={`signal-trade-plan${planStale ? " signal-trade-plan-stale" : ""}`}>
          <div>
            <dt>Direction</dt>
            <dd>{side}</dd>
          </div>
          <div>
            <dt>Action</dt>
            <dd>{lc.tradingAction ?? "WAIT"}</dd>
          </div>
          <div>
            <dt>Current price</dt>
            <dd>{displayPrice != null ? fmtPrice(displayPrice) : fmtPrice(lc.lastPrice)}</dd>
          </div>
          <div>
            <dt>Trigger</dt>
            <dd>{fmtPrice(lc.alertAt)}</dd>
          </div>
          <div className="signal-entry-zone">
            <dt>Entry zone</dt>
            <dd>
              {fmtPrice(lc.entryZone.low)} – {fmtPrice(lc.entryZone.high)}
              <span className="muted"> (mid {fmtPrice(entryMid)})</span>
            </dd>
          </div>
          <div>
            <dt>Stop loss</dt>
            <dd className="level-stop">{fmtPrice(lc.stop)}</dd>
          </div>
          <div>
            <dt>Target 1</dt>
            <dd className="level-t1">{fmtPrice(lc.t1)}</dd>
          </div>
          <div>
            <dt>Target 2</dt>
            <dd className="level-t2">{fmtPrice(lc.t2)}</dd>
          </div>
          {lc.t3 != null && (
            <div>
              <dt>Target 3</dt>
              <dd>{fmtPrice(lc.t3)}</dd>
            </div>
          )}
          <div>
            <dt>Risk / reward</dt>
            <dd>{rr != null && Number.isFinite(rr) ? `${rr.toFixed(2)}R to T1` : "—"}</dd>
          </div>
          <div className="signal-waiting-row">
            <dt>Waiting for</dt>
            <dd>{lc.waitingFor?.[0] ?? lc.watchingSummary ?? "—"}</dd>
          </div>
        </dl>
      ) : (
        <p className="muted">Loading trade plan for {symbol}…</p>
      )}

      <div className="signal-brief" role="status">
        {briefLines.map((line) => (
          <p key={line}>{line}</p>
        ))}
      </div>

      <p className="disclaimer">
        Signals only — no orders sent. Entry requires completed 5m confirmation, ~2R, fresh data, and
        full checklist. News never authorizes entry alone.
      </p>

      <button
        type="button"
        className="scan-btn signal-watch-btn"
        disabled={watchBusy}
        onClick={() => {
          void (async () => {
            if (configured && !session?.access_token) {
              navigate("/login");
              return;
            }
            setWatchBusy(true);
            setWatchMsg(null);
            try {
              if (session?.access_token) {
                await addMonitorSymbol(symbol, side, session.access_token);
                setWatchMsg(`Added ${symbol} to your live Watchlist monitor. Open Watchlist to see all cards.`);
              }
              toggleWatchlist(symbol);
            } catch (err) {
              setWatchMsg(friendlyApiError(err));
            } finally {
              setWatchBusy(false);
            }
          })();
        }}
      >
        {watchBusy ? "Adding…" : starred ? "On watchlist" : "Add to live watchlist"}
      </button>
      {watchMsg ? (
        <p className="muted" style={{ margin: "0.35rem 0 0", fontSize: "0.85rem" }}>
          {watchMsg}
        </p>
      ) : null}

      <button type="button" className="decision-section-toggle" onClick={() => setDetailsOpen((v) => !v)}>
        {detailsOpen ? "▾" : "▸"} Indicator checklist ({lc.conditionsPassed ?? "—"} /{" "}
        {lc.conditionsTotal ?? "—"})
      </button>
      {detailsOpen && (
        <div className="decision-section-body">
          <p className="muted">
            Setup score {score10 != null ? `${score10}/10` : "—"}
            {rr != null && Number.isFinite(rr) ? ` · ${rr.toFixed(2)}R to T1` : ""}
            {strat ? ` · ${strat}` : ""}
          </p>
          {lc.watchingSummary ? <p className="muted">{lc.watchingSummary}</p> : null}
          {lc.dataFresh === false && lc.dataFreshReason ? (
            <p className="muted">{lc.dataFreshReason}</p>
          ) : null}
          {lc.entryGeometry?.summary ? <p className="muted">{lc.entryGeometry.summary}</p> : null}
          {lc.marketDataAt ? (
            <p className="muted">
              Data {lc.dataFeed?.toUpperCase() ?? "IEX"} · {formatEtTime(lc.marketDataAt)}
            </p>
          ) : null}
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
          {lc.quoteTransparency ? (
            <p className="muted">
              Quote bid {lc.quoteTransparency.bid != null ? fmtPrice(lc.quoteTransparency.bid) : "—"} · ask{" "}
              {lc.quoteTransparency.ask != null ? fmtPrice(lc.quoteTransparency.ask) : "—"}
              {lc.quoteTransparency.spreadPct != null
                ? ` · spread ${lc.quoteTransparency.spreadPct.toFixed(2)}%`
                : ""}
              {lc.quoteTransparency.quoteAt
                ? ` · ${formatEtTime(lc.quoteTransparency.quoteAt)}`
                : ""}
              <br />
              {lc.quoteTransparency.priceBasis}
            </p>
          ) : null}
        </div>
      )}
    </aside>
  );
}
