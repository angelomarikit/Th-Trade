import { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  fetchOpportunities,
  promoteToMonitor,
  type OpportunityRow,
  type OpportunitiesResponse,
} from "../lib/api";
import { fmtPct } from "../lib/format";

export function OpportunitiesPage() {
  const { session } = useAuth();
  const token = session?.access_token ?? null;
  const [data, setData] = useState<OpportunitiesResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmTop, setConfirmTop] = useState(3);

  const run = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetchOpportunities({ top: 15, confirm: confirmTop, token });
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [confirmTop, token]);

  const promote = useCallback(
    async (rows: OpportunityRow[]) => {
      if (!token || rows.length === 0) return;
      setBusy(true);
      setError(null);
      try {
        await promoteToMonitor(
          rows.map((r) => ({ symbol: r.symbol, side: r.side })),
          token,
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(false);
      }
    },
    [token],
  );

  return (
    <div className="page opportunities-page">
      <header className="page-header">
        <div>
          <h1>Market Opportunities</h1>
          <p className="muted">
            Phase 5 discovery across a liquid universe — ranks LONG and SHORT candidates, then
            optional confirmation with unchanged gates (min 2R). Not entry permission. Auto-trading
            disabled.
          </p>
        </div>
        <div className="row gap">
          <label className="muted" style={{ fontSize: "0.85rem" }}>
            Confirm top{" "}
            <input
              type="number"
              min={0}
              max={8}
              value={confirmTop}
              onChange={(e) => setConfirmTop(Number(e.target.value) || 0)}
              style={{ width: "3.5rem" }}
            />
          </label>
          <button type="button" className="btn primary" disabled={busy} onClick={() => void run()}>
            {busy ? "Scanning…" : "Run discovery"}
          </button>
          <Link className="btn" to="/watchlist">
            Live Monitor
          </Link>
        </div>
      </header>

      {error ? <p className="error-banner">{error}</p> : null}

      {data ? (
        <p className="muted" style={{ fontSize: "0.85rem" }}>
          Universe {data.universeSize} · scanned {data.scanned} · {data.elapsedMs}ms · feed{" "}
          {(data.feed ?? "iex").toUpperCase()} · {data.disclaimer}
        </p>
      ) : (
        <p className="muted">Run discovery to rank the universe (uses batch IEX snapshots).</p>
      )}

      <div className="opp-grid">
        <RankTable
          title="Top LONG"
          rows={data?.long ?? []}
          busy={busy}
          onPromote={(r) => void promote([r])}
          onPromoteTop5={() => void promote((data?.long ?? []).slice(0, 5))}
        />
        <RankTable
          title="Top SHORT"
          rows={data?.short ?? []}
          busy={busy}
          onPromote={(r) => void promote([r])}
          onPromoteTop5={() => void promote((data?.short ?? []).slice(0, 5))}
        />
      </div>

      {data?.confirmed && data.confirmed.length > 0 ? (
        <section style={{ marginTop: "1.5rem" }}>
          <h2>Confirmation (unchanged gates)</h2>
          <p className="muted" style={{ fontSize: "0.85rem" }}>
            Deep evaluateSetup on top discovery picks — WAIT / NO TRADE expected when quality is
            weak.
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Symbol</th>
                  <th>Side</th>
                  <th>Disc.</th>
                  <th>State</th>
                  <th>R:R</th>
                  <th>Score</th>
                </tr>
              </thead>
              <tbody>
                {data.confirmed.map((c) => (
                  <tr key={`${c.side}-${c.symbol}`}>
                    <td>{c.symbol}</td>
                    <td>{c.side}</td>
                    <td>{c.discoveryScore}</td>
                    <td>{c.statusLabel || c.state}</td>
                    <td>{c.rewardToRisk?.toFixed?.(2) ?? "—"}</td>
                    <td>{c.qualityScore10 ?? "—"}</td>
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

function RankTable(props: {
  title: string;
  rows: OpportunityRow[];
  busy: boolean;
  onPromote: (r: OpportunityRow) => void;
  onPromoteTop5: () => void;
}) {
  return (
    <section>
      <div className="row gap" style={{ marginBottom: "0.5rem" }}>
        <h2 style={{ margin: 0 }}>{props.title}</h2>
        <button
          type="button"
          className="btn"
          disabled={props.busy || props.rows.length === 0}
          onClick={props.onPromoteTop5}
        >
          Add top 5 to monitor
        </button>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Symbol</th>
              <th>Score</th>
              <th>Day%</th>
              <th>vs SPY</th>
              <th>RVOL*</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {props.rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="muted">
                  No rows yet
                </td>
              </tr>
            ) : (
              props.rows.map((r, i) => (
                <tr key={r.symbol}>
                  <td>{i + 1}</td>
                  <td>
                    <strong>{r.symbol}</strong>
                    {r.catalystHeadline ? (
                      <div className="muted" style={{ fontSize: "0.75rem", maxWidth: 220 }}>
                        {r.catalystHeadline.slice(0, 80)}
                      </div>
                    ) : null}
                  </td>
                  <td>{r.rankScore}</td>
                  <td>{fmtPct(r.features?.dayChangePct)}</td>
                  <td>{fmtPct(r.features?.vsSpyPct)}</td>
                  <td>
                    {r.features?.rvolProxy != null ? `${r.features.rvolProxy.toFixed(2)}x` : "—"}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn"
                      disabled={props.busy}
                      onClick={() => props.onPromote(r)}
                    >
                      Monitor
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <p className="muted" style={{ fontSize: "0.75rem" }}>
        *RVOL proxy = day volume / prior day (IEX approximate). Not consolidated volume.
      </p>
    </section>
  );
}
