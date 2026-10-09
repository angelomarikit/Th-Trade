import { useEffect, useState } from "react";
import { fetchJournal, type JournalListResponse } from "../lib/api";
import { EmptyState } from "../components/common/EmptyState";

export function JournalPage() {
  const [data, setData] = useState<JournalListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    void fetchJournal(80)
      .then((j) => {
        setData(j);
        setError(null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="page">
      <h1 className="page-title">Trade Journal</h1>
      <p className="page-sub">
        Signal decision journal from the API (SQLite/memory). Separate from broker fills.
      </p>

      {loading && <p className="disclaimer">Loading journal…</p>}
      {error && (
        <EmptyState
          badge="Unavailable"
          title="Journal not available"
          body={error}
        />
      )}
      {!loading && !error && data && data.entries.length === 0 && (
        <EmptyState
          badge="Empty"
          title="No journal entries"
          body="Scans record here when the journal store is enabled. Outcomes are tracked separately from features."
        />
      )}
      {!loading && !error && data && data.entries.length > 0 && (
        <div className="panel">
          <div className="panel-h">
            <h3>{data.count} entries</h3>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Symbol</th>
                <th>Side</th>
                <th>State</th>
                <th>Score</th>
                <th>Strategy</th>
                <th>Outcome</th>
              </tr>
            </thead>
            <tbody>
              {data.entries.map((e) => (
                <tr key={e.id}>
                  <td>{new Date(e.decisionAt).toLocaleString()}</td>
                  <td>{e.symbol}</td>
                  <td>{e.side}</td>
                  <td>{e.state}</td>
                  <td className="num">{e.setupScore ?? "—"}</td>
                  <td>{e.strategyId ?? "—"}</td>
                  <td>{e.outcome.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
