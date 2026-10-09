import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useTerminal } from "../../context/TerminalContext";
import { fmtPrice } from "../../lib/format";

export function SignalRecommendPanel() {
  const { configured, session, plan, profile } = useAuth();
  const {
    data,
    loading,
    symbol,
    side,
    setSide,
    scan,
    watchlist,
    selectSymbol,
    toggleWatchlist,
  } = useTerminal();
  const signal = data?.signalRecommendation;

  const pickList = (() => {
    const base = watchlist.length ? watchlist : [];
    if (symbol && !base.includes(symbol)) return [symbol, ...base];
    return base;
  })();

  function onPick(sym: string) {
    if (sym === symbol && !loading) {
      void scan({ ticker: sym, side, brief: false });
      return;
    }
    selectSymbol(sym, { brief: false });
  }

  function onSide(next: "LONG" | "SHORT") {
    if (next === side && !loading) return;
    setSide(next);
    void scan({ ticker: symbol, side: next, brief: false });
  }

  return (
    <section className="panel">
      <div className="panel-h">
        <h3>Signal Recommendation</h3>
        {signal && (
          <span className={`badge ${actionClass(signal.action)}`}>{signal.action}</span>
        )}
      </div>
      <div className="tab-body">
        <p className="disclaimer" style={{ marginTop: 0 }}>
          Pick a watchlist symbol — recommendation updates from live scanner data. BUY / SELL only
          when confirmation is ACTIONABLE; otherwise WAIT.
        </p>

        <div className="signal-watch-block">
          <div className="signal-watch-row">
            <span className="signal-watch-label">Watchlist</span>
            <Link to="/watchlist" className="signal-watch-manage">
              Manage
            </Link>
          </div>

          {pickList.length === 0 ? (
            <p className="disclaimer" style={{ margin: 0 }}>
              No symbols yet. Star a ticker in the header or{" "}
              <Link to="/watchlist" style={{ color: "var(--teal)" }}>
                add to watchlist
              </Link>
              .
            </p>
          ) : (
            <div className="signal-symbol-picks" role="listbox" aria-label="Watchlist symbols">
              {pickList.map((s) => (
                <button
                  key={s}
                  type="button"
                  role="option"
                  aria-selected={s === symbol}
                  className={`signal-symbol-pick ${s === symbol ? "active" : ""}`}
                  disabled={loading && s === symbol}
                  onClick={() => onPick(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          <div className="signal-side-picks" role="group" aria-label="Trade side">
            <button
              type="button"
              className={`signal-side-pick ${side === "LONG" ? "active long" : ""}`}
              onClick={() => onSide("LONG")}
              disabled={loading}
            >
              LONG
            </button>
            <button
              type="button"
              className={`signal-side-pick ${side === "SHORT" ? "active short" : ""}`}
              onClick={() => onSide("SHORT")}
              disabled={loading}
            >
              SHORT
            </button>
            {symbol && !watchlist.includes(symbol) && (
              <button
                type="button"
                className="signal-side-pick"
                onClick={() => toggleWatchlist(symbol)}
                title="Add current symbol to watchlist"
              >
                + Watch
              </button>
            )}
          </div>
        </div>

        {loading && (
          <p className="disclaimer">
            Updating Signal Recommendation for {symbol} {side}…
          </p>
        )}

        {signal && (
          <div className="ai-result" style={{ marginTop: "0.65rem", paddingTop: 0, borderTop: 0 }}>
            <div className={`signal-action signal-${signal.action.toLowerCase()}`}>
              <span className="signal-action-label">Signal Recommendation</span>
              <strong>{signal.action}</strong>
              <span>
                {signal.recommendation} · {signal.confidence}
              </span>
            </div>

            <div className="metric-grid" style={{ marginTop: "0.65rem" }}>
              <div>
                <label>Symbol</label>
                <strong>
                  {symbol} {side}
                </strong>
              </div>
              <div>
                <label>Last</label>
                <strong>{fmtPrice(data?.liveCard.lastPrice ?? data?.card.lastPrice)}</strong>
              </div>
              <div>
                <label>Brief</label>
                <strong style={{ fontSize: "0.75rem" }}>
                  {signal.briefSource === "model" ? "MODEL" : "RULES"}
                </strong>
              </div>
              <div>
                <label>Credits</label>
                <strong>
                  {signal.creditsCharged ? `−${signal.creditsCharged}` : "0"}
                </strong>
              </div>
            </div>

            <pre className="ai-brief">{signal.brief}</pre>

            {signal.blockers.length > 0 && (
              <ul className="ai-blockers">
                {signal.blockers.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
            )}

            <button
              type="button"
              className="scan-btn"
              style={{ width: "100%", marginTop: "0.75rem" }}
              disabled={loading}
              onClick={() => void scan({ ticker: symbol, side, brief: true })}
            >
              Refresh model brief
            </button>

            <p className="disclaimer">
              Not financial advice. No orders are submitted. Execute manually in Thinkorswim if you
              choose.
            </p>
          </div>
        )}

        {!signal && !loading && (
          <button
            type="button"
            className="scan-btn"
            style={{ width: "100%" }}
            onClick={() => void scan({ ticker: symbol, side, brief: true })}
          >
            Scan for Signal Recommendation
          </button>
        )}

        {configured && session && plan?.aiEnabled && (
          <p className="disclaimer">
            Watchlist picks refresh rules instantly (no credits). Model brief costs{" "}
            {plan.aiCreditCost} cr when you tap Refresh model brief.
          </p>
        )}
        {configured &&
          session &&
          plan?.aiEnabled &&
          (profile?.credits_balance ?? 0) < (plan.aiCreditCost ?? 5) && (
            <p className="disclaimer">
              Not enough credits for a model brief — showing rules.{" "}
              <Link to="/billing" style={{ color: "var(--teal)" }}>
                Add credits / upgrade
              </Link>
              .
            </p>
          )}
      </div>
    </section>
  );
}

function actionClass(action: string): string {
  if (action === "BUY") return "green";
  if (action === "SELL") return "red";
  return "amber";
}
