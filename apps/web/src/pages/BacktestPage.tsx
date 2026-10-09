import { useEffect, useState } from "react";
import { fetchEdge, type EdgeResponse } from "../lib/api";
import { useTerminal } from "../context/TerminalContext";
import { fmtR } from "../lib/format";
import { EmptyState } from "../components/common/EmptyState";

export function BacktestPage() {
  const { symbol } = useTerminal();
  const [edge, setEdge] = useState<EdgeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    void fetchEdge(symbol)
      .then((e) => {
        setEdge(e);
        setError(null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  }, [symbol]);

  const panel = edge?.panel;
  const insufficient = panel != null && panel.sampleSize <= 0;

  return (
    <div className="page">
      <h1 className="page-title">Backtesting</h1>
      <p className="page-sub">
        Reuses existing Historical Edge calculations for {symbol}. Strategy semantics unchanged.
      </p>

      {loading && <p className="disclaimer">Computing edge…</p>}
      {error && <EmptyState badge="Error" title="Edge unavailable" body={error} />}
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
            </div>
            <p className="disclaimer">{panel.disclaimer}</p>
            <p className="disclaimer">
              Historical returns do not guarantee future performance. Setup score is not a calibrated
              win probability.
            </p>
            {edge?.text && (
              <pre
                style={{
                  whiteSpace: "pre-wrap",
                  fontFamily: "var(--mono)",
                  fontSize: "0.75rem",
                  color: "var(--muted)",
                  marginTop: "0.75rem",
                }}
              >
                {edge.text}
              </pre>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
