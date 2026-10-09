import { useTerminal } from "../context/TerminalContext";
import { ageLabel } from "../lib/format";
import { EmptyState } from "../components/common/EmptyState";

export function AlertsPage() {
  const { alerts, clearAlerts } = useTerminal();

  return (
    <div className="page">
      <h1 className="page-title">Alerts</h1>
      <p className="page-sub">
        Local in-app history only. Email / SMS / push delivery is not configured.
      </p>

      {alerts.length === 0 ? (
        <EmptyState
          badge="Local only"
          title="No alerts yet"
          body="Status changes and stale-data notices from Scanner will appear here. External notification channels are not wired."
        />
      ) : (
        <div className="panel">
          <div className="panel-h">
            <h3>History</h3>
            <button type="button" className="icon-btn" onClick={clearAlerts}>
              Clear
            </button>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>When</th>
                <th>Kind</th>
                <th>Message</th>
              </tr>
            </thead>
            <tbody>
              {alerts.map((a) => (
                <tr key={a.id}>
                  <td>{ageLabel(a.at)}</td>
                  <td>{a.kind}</td>
                  <td>{a.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
