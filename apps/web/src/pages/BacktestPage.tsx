import { useCallback, useEffect, useState } from "react";
import {
  fetchBacktestCompare,
  fetchEdge,
  fetchMeasuredPerformance,
  fetchStrategies,
  type BacktestCompareResponse,
  type EdgeResponse,
  type MeasuredPerformanceResponse,
} from "../lib/api";
import { useTerminal } from "../context/TerminalContext";
import { fmtR } from "../lib/format";
import { EmptyState } from "../components/common/EmptyState";

function MeasuredPanel({
  title,
  badge,
  measured,
}: {
  title: string;
  badge: string;
  measured: MeasuredPerformanceResponse | null;
}) {
  if (!measured) return null;
  return (
    <div className="panel" style={{ flex: "1 1 280px" }}>
      <div className="panel-h">
        <h3>{title}</h3>
        <span className="badge">{badge}</span>
      </div>
      <div className="tab-body">
        <p className="muted" style={{ fontSize: "0.8rem" }}>
          {measured.overall.note}
        </p>
        <div className="metric-grid">
          <div>
            <label>Samples</label>
            <strong>{measured.overall.sampleSize}</strong>
          </div>
          <div>
            <label>Resolved</label>
            <strong>{measured.overall.resolved}</strong>
          </div>
          <div>
            <label>Win %</label>
            <strong>
              {measured.overall.winRatePct != null
                ? `${measured.overall.winRatePct.toFixed(0)}%`
                : "—"}
            </strong>
          </div>
          <div>
            <label>Avg R</label>
            <strong>{fmtR(measured.overall.avgOutcomeR)}</strong>
          </div>
          <div>
            <label>liveValidated</label>
            <strong>{measured.overall.liveValidatedCount}</strong>
          </div>
        </div>
      </div>
    </div>
  );
}

export function BacktestPage() {
  const { symbol } = useTerminal();
  const [strategies, setStrategies] = useState<Array<{ id: string; name: string }>>([]);
  const [strategyId, setStrategyId] = useState("VWAP_RECLAIM");
  const [edge, setEdge] = useState<EdgeResponse | null>(null);
  const [compare, setCompare] = useState<BacktestCompareResponse | null>(null);
  const [measuredLive, setMeasuredLive] = useState<MeasuredPerformanceResponse | null>(null);
  const [measuredReplay, setMeasuredReplay] = useState<MeasuredPerformanceResponse | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetchStrategies()
      .then((r) => {
        const list = r.strategies ?? [];
        setStrategies(list.map((s) => ({ id: s.id, name: s.name })));
        setStrategyId((prev) =>
          list.some((s) => s.id === prev) ? prev : (list[0]?.id ?? prev),
        );
      })
      .catch(() => undefined);
  }, []);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [e, c, live, replay] = await Promise.all([
        fetchEdge(symbol, strategyId),
        fetchBacktestCompare(symbol),
        fetchMeasuredPerformance("LIVE"),
        fetchMeasuredPerformance("HISTORICAL_REPLAY"),
      ]);
      setEdge(e);
      setCompare(c);
      setMeasuredLive(live);
      setMeasuredReplay(replay);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [symbol, strategyId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const panel = edge?.panel;
  const insufficient = panel != null && panel.sampleSize <= 0;

  return (
    <div className="page">
      <h1 className="page-title">Backtesting & measured performance</h1>
      <p className="page-sub">
        Phase 6 — historical strategy compare for {symbol}, plus durable scanner history.
        LIVE and HISTORICAL_REPLAY are shown separately so hypothetical replay never mixes with
        live outcomes. Auto-trading disabled. Rates withheld until sample floors are met.
      </p>

      <div className="row gap" style={{ marginBottom: "1rem", flexWrap: "wrap" }}>
        <label className="muted" style={{ fontSize: "0.85rem" }}>
          Strategy{" "}
          <select value={strategyId} onChange={(e) => setStrategyId(e.target.value)}>
            {strategies.length === 0 ? (
              <option value={strategyId}>{strategyId}</option>
            ) : (
              strategies.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))
            )}
          </select>
        </label>
        <button type="button" className="btn" disabled={loading} onClick={() => void reload()}>
          Refresh
        </button>
      </div>

      {loading && <p className="disclaimer">Computing…</p>}
      {error && <EmptyState badge="Error" title="Unavailable" body={error} />}

      {!loading && !error && (
        <section style={{ marginBottom: "1.25rem" }}>
          <h2>Measured performance (separated sources)</h2>
          <p className="muted" style={{ fontSize: "0.85rem" }}>
            Use LIVE for scanner soak outcomes. Use REPLAY only for offline historical simulation.
            liveValidated counts toward launch confidence; raw LIVE alone is not a published edge.
          </p>
          <div className="row gap" style={{ flexWrap: "wrap", marginTop: "0.75rem" }}>
            <MeasuredPanel title="LIVE scanner history" badge="LIVE" measured={measuredLive} />
            <MeasuredPanel
              title="Historical replay"
              badge="REPLAY"
              measured={measuredReplay}
            />
          </div>
        </section>
      )}

      {!loading && !error && insufficient && (
        <EmptyState
          badge="Insufficient sample"
          title="Not enough historical trades"
          body="No fabricated win rate is shown when sample size is insufficient."
        />
      )}

      {!loading && !error && panel && !insufficient && (
        <div className="panel">
          <div className="panel-h">
            <h3>{panel.strategyName}</h3>
            <span className="badge">n={panel.sampleSize}</span>
          </div>
          <div className="tab-body">
            <div className="metric-grid">
              <div>
                <label>Win %</label>
                <strong>
                  {panel.winRatePct != null ? `${panel.winRatePct.toFixed(0)}%` : "—"}
                </strong>
              </div>
              <div>
                <label>Expectancy</label>
                <strong>{fmtR(panel.expectancyR)}</strong>
              </div>
              {panel.walkForward ? (
                <div>
                  <label>OOS expectancy</label>
                  <strong>{fmtR(panel.walkForward.oosExpectancyR)}</strong>
                </div>
              ) : null}
            </div>
            <p className="disclaimer">{panel.disclaimer}</p>
            <p className="disclaimer">
              Historical returns do not guarantee future performance. Setup score is not a calibrated
              win probability.
            </p>
          </div>
        </div>
      )}

      {compare && compare.strategies.length > 0 ? (
        <section style={{ marginTop: "1.25rem" }}>
          <h2>Strategy compare (walk-forward)</h2>
          <p className="muted" style={{ fontSize: "0.85rem" }}>
            {compare.disclaimer}
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Strategy</th>
                  <th>n</th>
                  <th>Win %</th>
                  <th>Exp R</th>
                  <th>OOS R</th>
                </tr>
              </thead>
              <tbody>
                {compare.strategies.map((s) => (
                  <tr key={s.strategyId}>
                    <td>{s.strategyName}</td>
                    <td>{s.sampleSize}</td>
                    <td>{s.winRatePct != null ? `${s.winRatePct.toFixed(0)}%` : "—"}</td>
                    <td>{fmtR(s.expectancyR)}</td>
                    <td>{fmtR(s.walkForward?.oosExpectancyR ?? null)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
