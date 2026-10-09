import { useTerminal } from "../context/TerminalContext";
import { EmptyState } from "../components/common/EmptyState";

export function SignalsPage() {
  const { data, recentScans } = useTerminal();
  const strategies = data?.liveCard.matchedStrategies ?? data?.card.matchedStrategies ?? [];

  return (
    <div className="page">
      <h1 className="page-title">Signals</h1>
      <p className="page-sub">Matched strategies from the latest scan — not a streaming signal firehose.</p>

      {strategies.length === 0 && recentScans.length === 0 ? (
        <EmptyState
          badge="Not configured"
          title="No live signal stream"
          body="Run Scanner to attach matched strategy definitions. Continuous multi-symbol signal broadcast is not implemented."
        />
      ) : (
        <div className="panel">
          <div className="panel-h">
            <h3>Matched on {data?.liveCard.headline ?? "—"}</h3>
          </div>
          {strategies.length === 0 ? (
            <div className="tab-body">
              <p className="disclaimer">No strategy matches on the current scan.</p>
            </div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Strategy</th>
                  <th>Family</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {strategies.map((s) => (
                  <tr key={s.strategyId}>
                    <td>{s.strategyName}</td>
                    <td>{s.family}</td>
                    <td>{s.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
