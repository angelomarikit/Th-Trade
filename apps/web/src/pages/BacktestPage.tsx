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

export function BacktestPage() {
  const { symbol } = useTerminal();
  const [strategies, setStrategies] = useState<Array<{ id: string; name: string }>>([]);
  const [strategyId, setStrategyId] = useState("VWAP_RECLAIM");
  const [edge, setEdge] = useState<EdgeResponse | null>(null);
  const [compare, setCompare] = useState<BacktestCompareResponse | null>(null);
  const [measured, setMeasured] = useState<MeasuredPerformanceResponse | null>(null);
  const [source, setSource] = useState<"ALL" | "LIVE" | "HISTORICAL_REPLAY">("ALL");
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
      const [e, c, m] = await Promise.all([
        fetchEdge(symbol, strategyId),
        fetchBacktestCompare(symbol),
        fetchMeasuredPerformance(source),
      ]);
      setEdge(e);
      setCompare(c);
      setMeasured(m);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [symbol, strategyId, source]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const panel = edge?.panel;
  const insufficient = panel != null && panel.sampleSize <= 0;

  return (
    <div className="page">
      <h1 className="page-title">Backtesting & measured performance</h1>
      <p className="page-sub">
        Phase 6 — historical strategy compare for {symbol}, plus durable scanner history stats.
        Auto-trading disabled. Rates withheld until sample floors are met. Not a published accuracy
        claim.
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
        <label className="muted" style={{ fontSize: "0.85rem" }}>
          History source{" "}
          <select
            value={source}
            onChange={(e) => setSource(e.target.value as typeof source)}
          >
            <option value="ALL">ALL</option>
            <option value="LIVE">LIVE only</option>
            <option value="HISTORICAL_REPLAY">REPLAY only</option>
          </select>
        </label>
        <button type="button" className="btn" disabled={loading} onClick={() => void reload()}>
          Refresh
        </button>
      </div>

      {loading && <p className="disclaimer">Computing…</p>}
      {error && <EmptyState badge="Error" title="Unavailable" body={error} />}

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
          <h2>Strategy compare</h2>
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

      {measured ? (
        <section style={{ marginTop: "1.25rem" }}>
          <h2>Measured scanner history</h2>
          <p className="muted" style={{ fontSize: "0.85rem" }}>
            {measured.disclaimer} Records considered: {measured.recordsConsidered}.{" "}
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
          {measured.bySymbol.length > 0 ? (
            <div className="table-wrap" style={{ marginTop: "0.75rem" }}>
              <table>
                <thead>
                  <tr>
                    <th>Symbol</th>
                    <th>n</th>
                    <th>W/L</th>
                    <th>Win %</th>
                  </tr>
                </thead>
                <tbody>
                  {measured.bySymbol.slice(0, 12).map((b) => (
                    <tr key={b.key}>
                      <td>{b.key}</td>
                      <td>{b.sampleSize}</td>
                      <td>
                        {b.wins}/{b.losses}
                      </td>
                      <td>{b.winRatePct != null ? `${b.winRatePct.toFixed(0)}%` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
