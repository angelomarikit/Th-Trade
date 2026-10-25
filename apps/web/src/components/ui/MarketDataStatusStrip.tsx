import { useTerminal } from "../../context/TerminalContext";
import { effectiveTradingAction } from "../../lib/effectiveTradingAction";

/** Separates API connectivity from quote freshness, indicator verification, and entry permission. */
export function MarketDataStatusStrip() {
  const { data, feedConnected, loading, side } = useTerminal();
  const lc = data?.liveCard;
  const md = lc?.marketDataStatus;

  const indicatorsVerified = lc?.dataFresh === true;
  const entryPermitted = effectiveTradingAction(lc, side) === "ENTER";

  return (
    <div className="market-data-status" role="status" aria-label="Market data status">
      <span className={`mds-item ${feedConnected ? "ok" : "bad"}`} title="Health check to the WULU API / Alpaca path">
        API {feedConnected ? "connected" : "down"}
      </span>
      <span
        className={`mds-item ${md?.quoteFresh ? "ok" : md?.quotePresent ? "warn" : "muted"}`}
        title={
          md?.quoteAgeSec != null
            ? `NBBO quote age ~${md.quoteAgeSec.toFixed(0)}s`
            : "No usable bid/ask on this scan"
        }
      >
        Quote {md?.quoteFresh ? "fresh" : md?.quotePresent ? "stale/wide" : "missing"}
      </span>
      <span
        className={`mds-item ${md?.barsFresh ? "ok" : "warn"}`}
        title={md?.barsAgeSec != null ? `Last 1m bar ~${md.barsAgeSec.toFixed(0)}s old` : "Bar age unknown"}
      >
        Bars {md?.barsFresh ? "current" : "lagging"}
      </span>
      <span className={`mds-item ${indicatorsVerified ? "ok" : "warn"}`} title="Setup evaluation passed freshness gates">
        Setup {indicatorsVerified ? "verified" : "not verified"}
      </span>
      <span className={`mds-item ${entryPermitted ? "ok" : "muted"}`} title="ENTER requires all mandatory gates">
        Entry {entryPermitted ? "permitted" : "blocked"}
      </span>
      {loading ? <span className="mds-item muted">Updating…</span> : null}
      {md?.summary &&
      lc?.dataFresh === false &&
      md.summary !== lc.dataFreshReason ? (
        <p className="mds-summary">{md.summary}</p>
      ) : null}
    </div>
  );
}
