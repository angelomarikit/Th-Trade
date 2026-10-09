import { Link } from "react-router-dom";
import { useTerminal } from "../context/TerminalContext";
import { ageLabel } from "../lib/format";

export function OverviewPage() {
  const { health, data, symbol, recentScans, alerts, feedConnected, selectSymbol } = useTerminal();
  const session = data?.liveCard.session ?? data?.card.session;

  return (
    <div className="page">
      <h1 className="page-title">Overview</h1>
      <p className="page-sub">Workstation status from live backend health and recent scans — no fabricated KPIs.</p>

      <div className="kpi-grid">
        <div className="panel kpi">
          <span>Market session</span>
          <strong>{session?.session ?? "N/A"}</strong>
        </div>
        <div className="panel kpi">
          <span>Feed</span>
          <strong>{feedConnected ? "Connected" : "Down"}</strong>
        </div>
        <div className="panel kpi">
          <span>Selected symbol</span>
          <strong>{symbol}</strong>
        </div>
        <div className="panel kpi">
          <span>Account env</span>
          <strong>{health?.accountEnvironment ?? "SIGNALS_ONLY"}</strong>
        </div>
        <div className="panel kpi">
          <span>Local alerts</span>
          <strong>{alerts.length}</strong>
        </div>
        <div className="panel kpi">
          <span>Journal entries</span>
          <strong>{health?.journalCount ?? "N/A"}</strong>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: "0.75rem" }}>
        <div className="panel-h">
          <h3>Current scan</h3>
          <Link to="/scanner" className="badge teal">
            Open scanner
          </Link>
        </div>
        <div className="tab-body">
          {data ? (
            <div className="metric-grid">
              <div>
                <label>Status</label>
                <strong>{data.liveCard.status}</strong>
              </div>
              <div>
                <label>Score</label>
                <strong>{data.liveCard.setupScore}</strong>
              </div>
              <div>
                <label>Regime</label>
                <strong>{data.liveCard.marketRegime ?? "—"}</strong>
              </div>
              <div>
                <label>Data</label>
                <strong>{data.card.dataFresh ? "Fresh" : "Not verified"}</strong>
              </div>
            </div>
          ) : (
            <p className="disclaimer">No scan loaded yet.</p>
          )}
        </div>
      </div>

      <div className="panel">
        <div className="panel-h">
          <h3>Recent scans</h3>
        </div>
        {recentScans.length === 0 ? (
          <div className="tab-body">
            <p className="disclaimer">N/A — run a scan from Scanner.</p>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>When</th>
                <th>Symbol</th>
                <th>Side</th>
                <th>Status</th>
                <th>Score</th>
              </tr>
            </thead>
            <tbody>
              {recentScans.map((r) => (
                <tr key={`${r.symbol}-${r.at}`} className="clickable" onClick={() => selectSymbol(r.symbol)}>
                  <td>{ageLabel(r.at)}</td>
                  <td>{r.symbol}</td>
                  <td>{r.side}</td>
                  <td>{r.status}</td>
                  <td className="num">{r.score ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
