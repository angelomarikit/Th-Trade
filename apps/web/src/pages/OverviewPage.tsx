import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTerminal } from "../context/TerminalContext";
import { fetchRank } from "../lib/api";
import { ageLabel, fmtPct } from "../lib/format";

export function OverviewPage() {
  const {
    health,
    data,
    symbol,
    recentScans,
    alerts,
    feedConnected,
    selectSymbol,
    watchlist,
  } = useTerminal();
  const session = data?.liveCard.session ?? data?.card.session;
  const [rank, setRank] = useState<Awaited<ReturnType<typeof fetchRank>> | null>(null);
  const [rankError, setRankError] = useState<string | null>(null);

  useEffect(() => {
    const tickers = (watchlist.length ? watchlist : [symbol]).slice(0, 8);
    if (!tickers.length) return;
    let cancelled = false;
    void fetchRank(tickers)
      .then((r) => {
        if (!cancelled) {
          setRank(r);
          setRankError(null);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setRank(null);
          setRankError(err instanceof Error ? err.message : String(err));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [watchlist, symbol]);

  return (
    <div className="page">
      <h1 className="page-title">Overview</h1>
      <p className="page-sub">
        Workstation status from live backend health and recent scans — no fabricated KPIs.
      </p>

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
              {data.liveCard.relativeMomentum && (
                <div>
                  <label>vs SPY</label>
                  <strong>{fmtPct(data.liveCard.relativeMomentum.vsSpyPct)}</strong>
                </div>
              )}
            </div>
          ) : (
            <p className="disclaimer">No scan loaded yet.</p>
          )}
        </div>
      </div>

      <div className="panel" style={{ marginBottom: "0.75rem" }}>
        <div className="panel-h">
          <h3>Watchlist relative momentum</h3>
          <span className="badge">{rank?.feed?.toUpperCase() ?? "—"}</span>
        </div>
        <div className="tab-body">
          {rankError && <p className="disclaimer">{rankError}</p>}
          {!rankError && !rank && <p className="disclaimer">Loading ranking…</p>}
          {rank && (
            <>
              <p className="disclaimer" style={{ marginTop: 0 }}>
                {rank.disclaimer}
              </p>
              <table className="table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Symbol</th>
                    <th>Score</th>
                    <th>vs SPY</th>
                    <th>RVOL</th>
                    <th>Trend</th>
                  </tr>
                </thead>
                <tbody>
                  {rank.ranked.map((r) => (
                    <tr
                      key={r.symbol}
                      className="clickable"
                      onClick={() => selectSymbol(r.symbol)}
                    >
                      <td>{r.rank}</td>
                      <td>{r.symbol}</td>
                      <td className="num">{r.momentum.rankScore}</td>
                      <td className="num">{fmtPct(r.momentum.vsSpyPct)}</td>
                      <td className="num">
                        {r.momentum.rvol != null ? `${r.momentum.rvol.toFixed(2)}x` : "—"}
                      </td>
                      <td>{r.momentum.intradayTrend}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
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
                <tr
                  key={`${r.symbol}-${r.at}`}
                  className="clickable"
                  onClick={() => selectSymbol(r.symbol)}
                >
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
