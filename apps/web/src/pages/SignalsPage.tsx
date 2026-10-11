import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../context/AuthContext";
import { EmptyState } from "../components/common/EmptyState";
import {
  fetchSignalPerformance,
  fetchSignalReplay,
  type SignalPerformanceRow,
} from "../lib/api";
import { ageLabel } from "../lib/format";

export function SignalsPage() {
  const { session } = useAuth();
  const token = session?.access_token ?? null;
  const [records, setRecords] = useState<SignalPerformanceRow[]>([]);
  const [summary, setSummary] = useState<{
    total: number;
    actionable: number;
    invalidated: number;
    missed: number;
    liveValidated?: number;
    note: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [replayTicker, setReplayTicker] = useState("NVDA");
  const [replaySide, setReplaySide] = useState<"LONG" | "SHORT">("LONG");
  const [replayBusy, setReplayBusy] = useState(false);
  const [replayInfo, setReplayInfo] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await fetchSignalPerformance(token, 60);
      setRecords(data.records);
      setSummary(data.summary);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [token]);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh(), 20_000);
    return () => window.clearInterval(id);
  }, [refresh]);

  async function onReplay(e: FormEvent) {
    e.preventDefault();
    setReplayBusy(true);
    setReplayInfo(null);
    try {
      const r = await fetchSignalReplay(replayTicker.trim().toUpperCase(), replaySide, 50);
      const states = r.transitions
        .slice(0, 6)
        .map((t) => `${t.from}→${t.to}`)
        .join(" · ");
      setReplayInfo(
        `${r.label} · ${r.symbol} ${r.side} · ${r.steps.length} steps · ${r.transitions.length} transitions` +
          (states ? ` · ${states}` : " · no state transitions in window") +
          " · NOT live-validated",
      );
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setReplayBusy(false);
    }
  }

  return (
    <div className="page">
      <h1 className="page-title">Signals & performance</h1>
      <p className="page-sub">
        Recorded monitor evaluations and historical replay samples. Counts are a foundation — not a
        published win rate. liveValidated stays false until US regular-hours confirmation. Automatic
        trading remains disabled.
      </p>

      {summary ? (
        <div
          className="panel"
          style={{
            marginBottom: "0.75rem",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
            gap: "0.5rem",
            padding: "0.75rem 0.9rem",
          }}
        >
          <span>Total: {summary.total}</span>
          <span>Actionable: {summary.actionable}</span>
          <span>Invalidated: {summary.invalidated}</span>
          <span>Missed: {summary.missed}</span>
          <span>Live validated: {summary.liveValidated ?? 0}</span>
        </div>
      ) : null}

      <form className="scan-controls" onSubmit={onReplay} style={{ marginBottom: "0.85rem", flexWrap: "wrap" }}>
        <input
          value={replayTicker}
          onChange={(e) => setReplayTicker(e.target.value.toUpperCase())}
          placeholder="Replay ticker"
          maxLength={8}
          style={{
            border: "1px solid var(--border)",
            background: "var(--surface)",
            borderRadius: 8,
            padding: "0.55rem 0.7rem",
            fontFamily: "var(--mono)",
          }}
        />
        <select
          value={replaySide}
          onChange={(e) => setReplaySide(e.target.value as "LONG" | "SHORT")}
          style={{
            border: "1px solid var(--border)",
            background: "var(--surface)",
            borderRadius: 8,
            padding: "0.55rem 0.7rem",
            fontFamily: "var(--mono)",
          }}
        >
          <option value="LONG">LONG</option>
          <option value="SHORT">SHORT</option>
        </select>
        <button type="submit" className="scan-btn" disabled={replayBusy}>
          Run historical replay
        </button>
        <button type="button" className="icon-btn" onClick={() => void refresh()}>
          Refresh history
        </button>
      </form>
      {replayInfo ? <p className="disclaimer">{replayInfo}</p> : null}
      {error ? (
        <p style={{ color: "var(--danger, #c44)", fontSize: "0.85rem" }}>{error}</p>
      ) : null}
      {summary?.note ? <p className="disclaimer">{summary.note}</p> : null}

      {records.length === 0 ? (
        <EmptyState
          badge="Foundation"
          title="No signal history yet"
          body="Monitor ticks and historical replay write into this log (memory + Supabase when migration is applied). Apply supabase/migrations/20261012_phase3_signal_history.sql for durable storage."
        />
      ) : (
        <div className="panel">
          <div className="panel-h">
            <h3>Recent records</h3>
          </div>
          <table className="table">
            <thead>
              <tr>
                <th>When</th>
                <th>Symbol</th>
                <th>State</th>
                <th>Score</th>
                <th>Source</th>
                <th>Flags</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id}>
                  <td>{ageLabel(Date.parse(r.signalTimestamp))}</td>
                  <td>
                    {r.symbol} · {r.side}
                  </td>
                  <td>{r.state}</td>
                  <td>{r.qualityScore10 != null ? `${r.qualityScore10}/10` : "—"}</td>
                  <td>{r.source}</td>
                  <td>
                    {r.actionable ? "actionable · " : ""}
                    {r.dataQualityOk ? "fresh · " : "stale · "}
                    {r.liveValidated ? "RTH validated" : "not RTH-validated"}
                    {r.falseBreakoutRisk ? ` · fake ${r.falseBreakoutRisk}` : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
