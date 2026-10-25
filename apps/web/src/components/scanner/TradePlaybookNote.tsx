import { useMemo } from "react";
import { useTerminal } from "../../context/TerminalContext";
import { effectiveTradingAction } from "../../lib/effectiveTradingAction";
import { buildTradePlaybook } from "../../lib/tradePlaybook";
import { setupMatchesSelectedSide } from "../../lib/setupSideSync";

/**
 * “Why this zone / what to do” — chart area, gates, news, and next step in one place.
 */
export function TradePlaybookNote() {
  const { data, symbol, side, loading, displayPrice } = useTerminal();
  const lc = data?.liveCard;

  const playbook = useMemo(() => {
    if (!lc || !setupMatchesSelectedSide(data, side)) return null;
    const action = effectiveTradingAction(lc, side);
    return buildTradePlaybook({
      symbol,
      side,
      liveCard: lc,
      displayAction: action,
      displayPrice,
    });
  }, [data, lc, side, symbol, displayPrice]);

  if (!lc) {
    return (
      <section className="trade-playbook-note panel" aria-label="Trade playbook">
        <p className="muted" style={{ margin: 0 }}>
          {loading ? "Loading trade context…" : "Search a symbol for zone, gates, and next steps."}
        </p>
      </section>
    );
  }

  if (!playbook) {
    return (
      <section className="trade-playbook-note panel" aria-label="Trade playbook">
        <p className="muted" style={{ margin: 0 }}>
          {loading ? `Loading ${side} playbook…` : `Rescan ${side} to align chart, gates, and plan.`}
        </p>
      </section>
    );
  }

  return (
    <section className="trade-playbook-note panel" aria-label="Trade playbook">
      <header className="trade-playbook-head">
        <h2>{playbook.headline}</h2>
        <span className="trade-playbook-badge">{side}</span>
      </header>

      <div className="trade-playbook-block">
        <h3>Why this area (chart & levels)</h3>
        <p>{playbook.whyThisZone}</p>
        {playbook.chartSessionLine ? (
          <p className="trade-playbook-meta">{playbook.chartSessionLine}</p>
        ) : null}
      </div>

      <div className="trade-playbook-block trade-playbook-do">
        <h3>What to do now</h3>
        <p>{playbook.doNow}</p>
      </div>

      {playbook.newsLine ? (
        <div className="trade-playbook-block">
          <h3>News & catalyst</h3>
          <p>{playbook.newsLine}</p>
        </div>
      ) : null}

      <div className="trade-playbook-gates">
        <div>
          <h3>Gates passed</h3>
          {playbook.gatesPassed.length === 0 ? (
            <p className="muted">None yet — see blocking list.</p>
          ) : (
            <ul className="signal-checklist">
              {playbook.gatesPassed.map((g) => (
                <li key={g.label} className="check-pass">
                  <strong>{g.label}</strong>
                  <span>PASS</span>
                  <p>{g.reason}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <h3>Still need / failed</h3>
          {playbook.gatesBlocking.length === 0 ? (
            <p className="muted">All required gates PASS for this side.</p>
          ) : (
            <ul className="signal-checklist">
              {playbook.gatesBlocking.map((g) => (
                <li
                  key={g.label}
                  className={g.status === "FAIL" ? "check-fail" : "check-waiting"}
                >
                  <strong>{g.label}</strong>
                  <p>{g.reason}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
