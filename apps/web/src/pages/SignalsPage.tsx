import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../context/AuthContext";
import { EmptyState } from "../components/common/EmptyState";
import { PageHeader } from "../components/ui/PageHeader";
import {
  fetchOpenSignalOutcomes,
  fetchSignalPerformance,
  fetchSignalReplay,
  type SignalPerformanceRow,
} from "../lib/api";
import { ageLabel, fmtPrice } from "../lib/format";

export function SignalsPage() {
  const { session } = useAuth();
  const token = session?.access_token ?? null;
  const [records, setRecords] = useState<SignalPerformanceRow[]>([]);
  const [openTracks, setOpenTracks] = useState<
    Array<{
      id: string;
      symbol: string;
      side: string;
      entryPrice: number;
      entryAt: string;
      stop: number;
      target1: number;
      target2: number;
      barsElapsed: number;
      source: string;
    }>
  >([]);
  const [summary, setSummary] = useState<{
    total: number;
    actionable: number;
    invalidated: number;
    missed: number;
    liveValidated?: number;
    resolved?: number;
    wins?: number;
    losses?: number;
    ambiguous?: number;
    note: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [replayTicker, setReplayTicker] = useState("NVDA");
  const [replaySide, setReplaySide] = useState<"LONG" | "SHORT">("LONG");
  const [replayBusy, setReplayBusy] = useState(false);
  const [replayInfo, setReplayInfo] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [data, open] = await Promise.all([
        fetchSignalPerformance(token, 60),
        fetchOpenSignalOutcomes(token).catch(() => null),
      ]);
      setRecords(data.records);
      setSummary(data.summary);
      if (open) setOpenTracks(open.open);
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
      const outcomeBits = (r.outcomes ?? [])
        .slice(0, 4)
        .map((o) => `${o.detail}${o.outcomeR != null ? ` R=${o.outcomeR.toFixed(2)}` : ""}`)
        .join(" · ");
      setReplayInfo(
        `${r.label} · ${r.symbol} ${r.side} · ${r.steps.length} steps · ${r.transitions.length} transitions` +
          (states ? ` · ${states}` : " · no state transitions in window") +
          (outcomeBits ? ` · outcomes: ${outcomeBits}` : " · no resolved outcomes in window") +
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
      <PageHeader
        title="Signals & performance"
        subtitle="Recorded monitor evaluations and historical replay samples. Counts are a foundation — not a published win rate. liveValidated stays false until US regular-hours confirmation. Automatic trading remains disabled."
        actions={
          <button type="button" className="btn" onClick={() => void refresh()}>
            Refresh
          </button>
        }
      />

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
          <span>Resolved: {summary.resolved ?? "—"}</span>
          <span>Wins*: {summary.wins ?? "—"}</span>
          <span>Losses*: {summary.losses ?? "—"}</span>
          <span>Invalidated: {summary.invalidated}</span>
          <span>Missed: {summary.missed}</span>
          <span>Live validated: {summary.liveValidated ?? 0}</span>
        </div>
      ) : null}
      <p className="disclaimer" style={{ marginTop: "-0.35rem" }}>
        *Hypothetical 5m-bar outcomes (replay/live tracking) — not a published win rate. Ambiguous
        same-bar stop+target cases are excluded from win/loss claims. RTH live validation is separate.
      </p>

      {openTracks.length > 0 ? (
        <div className="panel" style={{ marginBottom: "0.75rem" }}>
          <div className="panel-h">
            <h3>Open tracked entries ({openTracks.length})</h3>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.55rem", padding: "0.55rem 0.75rem" }}>
            {openTracks.map((t) => (
              <div
                key={t.id}
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  padding: "0.55rem 0.65rem",
                  fontFamily: "var(--mono)",
                  fontSize: "0.82rem",
                }}
              >
                <strong>
                  {t.symbol} — {t.side}
                </strong>{" "}
                <span className="badge amber">OPEN</span>
                <div style={{ marginTop: "0.35rem", opacity: 0.9 }}>
                  Entry {fmtPrice(t.entryPrice)} · Stop {fmtPrice(t.stop)} · T1 {fmtPrice(t.target1)} ·
                  T2 {fmtPrice(t.target2)}
                </div>
                <div style={{ opacity: 0.75 }}>
                  {t.source} · bars {t.barsElapsed} · since {ageLabel(Date.parse(t.entryAt))}
                </div>
              </div>
            ))}
          </div>
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
          <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem", padding: "0.55rem 0.75rem" }}>
            {records.map((r) => (
              <div
                key={r.id}
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  padding: "0.55rem 0.65rem",
                  fontSize: "0.82rem",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem", flexWrap: "wrap" }}>
                  <strong style={{ fontFamily: "var(--mono)" }}>
                    {r.symbol} — {r.side}
                  </strong>
                  <span className="badge">{r.outcomeStatus}</span>
                </div>
                <div style={{ fontFamily: "var(--mono)", marginTop: "0.3rem", opacity: 0.9 }}>
                  {r.state} · score {r.qualityScore10 != null ? `${r.qualityScore10}/10` : "—"} ·{" "}
                  {r.source}
                </div>
                <div style={{ opacity: 0.75, marginTop: "0.2rem" }}>
                  {ageLabel(Date.parse(r.signalTimestamp))} ·{" "}
                  {r.dataQualityOk ? "fresh" : "stale"} ·{" "}
                  {r.liveValidated ? "RTH validated" : "not RTH-validated"}
                  {r.falseBreakoutRisk ? ` · fake ${r.falseBreakoutRisk}` : ""}
                  {r.outcomeR != null ? ` · R ${r.outcomeR.toFixed(2)}` : ""}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
