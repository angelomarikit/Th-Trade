import { useEffect, useState } from "react";
import { fetchJournal, type JournalListResponse } from "../lib/api";
import { EmptyState } from "../components/common/EmptyState";

export function JournalPage() {
  const [data, setData] = useState<JournalListResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showRoutine, setShowRoutine] = useState(false);

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
        Decisions worth keeping: when a setup changes state. Repeated “not verified” checks stay hidden.
      </p>
      <label style={{ display: "inline-flex", gap: "0.4rem", alignItems: "center", marginBottom: "0.75rem" }}>
        <input type="checkbox" checked={showRoutine} onChange={(e) => setShowRoutine(e.target.checked)} />
        Show routine checks
      </label>

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
        <JournalTable entries={data.entries} showRoutine={showRoutine} />
      )}
    </div>
  );
}

function isRoutine(state: string): boolean {
  const u = state.toUpperCase();
  return u.includes("DATA_NOT") || u === "WAIT" || u.includes("NO_TRADE");
}

function JournalTable({
  entries,
  showRoutine,
}: {
  entries: JournalListResponse["entries"];
  showRoutine: boolean;
}) {
  const rows = showRoutine ? entries : entries.filter((e) => !isRoutine(e.state));
  if (rows.length === 0) {
    return (
      <EmptyState
        badge="Journal"
        title="No trade decisions yet"
        body="Routine not-verified checks are hidden. A row appears here when a setup changes into a real decision."
      />
    );
  }
  return (
    <div className="panel">
      <div className="panel-h">
        <h3>{rows.length} entries</h3>
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
          {rows.map((e) => (
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
  );
}
