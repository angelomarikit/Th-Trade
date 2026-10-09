import { useMemo, useState } from "react";
import { useTerminal } from "../../context/TerminalContext";
import { fmtPrice, fmtR } from "../../lib/format";
import { SignalRecommendPanel } from "./SignalRecommendPanel";

type Tab = "setup" | "risk" | "orders";

export function SetupInspector() {
  const { data, side } = useTerminal();
  const [tab, setTab] = useState<Tab>("setup");
  const [riskPct, setRiskPct] = useState(2);
  const [hypCapital, setHypCapital] = useState("");

  const lc = data?.liveCard;
  const sizing = data?.positionSizing;
  const verified = data?.verifiedAccountConfigured === true;

  const hyp = useMemo(() => {
    if (!lc) return null;
    const capital = Number(hypCapital);
    if (!Number.isFinite(capital) || capital <= 0) return null;
    const entry = (lc.entryZone.low + lc.entryZone.high) / 2;
    const stopDist = Math.abs(entry - lc.stop);
    if (stopDist <= 0) return null;
    const dollars = capital * (Math.min(Math.max(riskPct, 0.1), 2) / 100);
    const shares = Math.floor(dollars / stopDist);
    const reward = Math.abs(lc.t1 - entry) * shares;
    return {
      shares,
      dollars,
      exposure: shares * entry,
      reward,
      r: stopDist > 0 ? Math.abs(lc.t1 - entry) / stopDist : null,
    };
  }, [hypCapital, riskPct, lc]);

  return (
    <aside className="inspector">
      <SignalRecommendPanel />
      <section className="panel">
        <div className="tabs">
          {(
            [
              ["setup", "Setup"],
              ["risk", "Risk"],
              ["orders", "Orders"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={tab === id ? "active" : ""}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="tab-body">
          {tab === "setup" && lc && (
            <>
              <div className="metric-grid">
                <div>
                  <label>Direction</label>
                  <strong className={side === "LONG" ? "up" : "down"}>{side}</strong>
                </div>
                <div>
                  <label>Score</label>
                  <strong>{lc.setupScore}</strong>
                </div>
                <div>
                  <label>Trigger</label>
                  <strong>{fmtPrice(lc.alertAt)}</strong>
                </div>
                <div>
                  <label>R:R</label>
                  <strong>{fmtR(lc.rewardToRisk)}</strong>
                </div>
              </div>
              <table className="level-table" style={{ marginTop: "0.75rem" }}>
                <tbody>
                  <tr>
                    <td>Zone</td>
                    <td>
                      {fmtPrice(lc.entryZone.low)}–{fmtPrice(lc.entryZone.high)}
                    </td>
                  </tr>
                  <tr>
                    <td>Stop</td>
                    <td>{fmtPrice(lc.stop)}</td>
                  </tr>
                  <tr>
                    <td>T1 / T2</td>
                    <td>
                      {fmtPrice(lc.t1)} / {fmtPrice(lc.t2)}
                    </td>
                  </tr>
                </tbody>
              </table>
              {lc.waitingFor.length > 0 && (
                <>
                  <p className="disclaimer" style={{ marginTop: "0.75rem" }}>
                    Waiting for
                  </p>
                  <ul style={{ margin: "0.25rem 0 0", paddingLeft: "1.1rem", fontSize: "0.8rem" }}>
                    {lc.waitingFor.map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                </>
              )}
            </>
          )}

          {tab === "risk" && (
            <>
              <div className="banner info">
                Verified account sizing:{" "}
                {verified
                  ? sizing?.calculated
                    ? `${sizing.shares} shares · $${sizing.dollarsAtRisk?.toFixed(2)} risk`
                    : sizing?.message
                  : "Not configured (VERIFIED_ACCOUNT_VALUE)"}
              </div>
              <p className="disclaimer">
                Hypothetical calculator below does not use broker buying power and is not an order.
              </p>
              <div className="field">
                <label htmlFor="hyp-cap">Hypothetical capital ($)</label>
                <input
                  id="hyp-cap"
                  inputMode="decimal"
                  value={hypCapital}
                  onChange={(e) => setHypCapital(e.target.value)}
                  placeholder="e.g. 25000"
                />
              </div>
              <div className="field">
                <label htmlFor="risk-pct">Risk % (max 2%)</label>
                <input
                  id="risk-pct"
                  type="number"
                  min={0.1}
                  max={2}
                  step={0.1}
                  value={riskPct}
                  onChange={(e) => setRiskPct(Number(e.target.value))}
                />
              </div>
              {hyp && (
                <div className="metric-grid">
                  <div>
                    <label>Shares</label>
                    <strong>{hyp.shares}</strong>
                  </div>
                  <div>
                    <label>$ risk</label>
                    <strong>{hyp.dollars.toFixed(2)}</strong>
                  </div>
                  <div>
                    <label>Exposure</label>
                    <strong>{hyp.exposure.toFixed(2)}</strong>
                  </div>
                  <div>
                    <label>T1 R</label>
                    <strong>{fmtR(hyp.r)}</strong>
                  </div>
                </div>
              )}
            </>
          )}

          {tab === "orders" && (
            <>
              <div className="banner warn">
                <strong>Signal only — no order submitted</strong>
              </div>
              <p className="disclaimer">
                This build is SIGNALS ONLY. Alpaca is used for market data and news. Manual execution
                is intended on Thinkorswim. Paper and live order placement are not enabled.
              </p>
              <p className="disclaimer">
                automaticOrders={String(data?.safety.automaticOrders ?? false)} · platform{" "}
                {data?.safety.executionPlatform ?? "thinkorswim"}
              </p>
            </>
          )}

          {!lc && tab !== "orders" && (
            <p className="disclaimer">Run a scan to populate the inspector.</p>
          )}
        </div>
      </section>

      {lc?.options && (
        <section className="panel">
          <div className="panel-h">
            <h3>Options</h3>
            <span className="badge">{lc.options.enabled ? "flag on" : "flag off"}</span>
          </div>
          <div className="tab-body">
            <p className="disclaimer" style={{ marginTop: 0 }}>
              {lc.options.reason}
            </p>
          </div>
        </section>
      )}
    </aside>
  );
}
