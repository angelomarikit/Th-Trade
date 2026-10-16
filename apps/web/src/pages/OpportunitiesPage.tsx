import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { DataTable, EmptyTableRow } from "../components/ui/DataTable";
import { PageHeader } from "../components/ui/PageHeader";
import { StatusBadge } from "../components/ui/StatusBadge";
import { useAuth } from "../context/AuthContext";
import { useOpenSymbol } from "../hooks/useOpenSymbol";
import {
  fetchOpportunities,
  promoteToMonitor,
  type OpportunityRow,
  type OpportunitiesResponse,
} from "../lib/api";
import { fmtPct, fmtPrice } from "../lib/format";

export function OpportunitiesPage() {
  const { session } = useAuth();
  const token = session?.access_token ?? null;
  const openSymbol = useOpenSymbol();
  const [data, setData] = useState<OpportunitiesResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmTop, setConfirmTop] = useState(0);
  const [tab, setTab] = useState<"LONG" | "SHORT">("LONG");

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

  useEffect(() => {
    void run();
  }, [run]);

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

  const rows = tab === "LONG" ? (data?.long ?? []) : (data?.short ?? []);

  return (
    <div className="page opportunities-page">
      <PageHeader
        title="Market Opportunities"
        subtitle="Liquid-universe discovery ranks. Not entry permission. Auto-trading disabled. Numbers from live discovery API only."
        actions={
          <>
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
              {busy ? "Scanning…" : "Refresh"}
            </button>
            <Link className="btn" to="/watchlist">
              Watchlist
            </Link>
          </>
        }
      />

      {error ? <p className="error-banner banner error">{error}</p> : null}

      {data ? (
        <p className="muted" style={{ fontSize: "0.85rem" }}>
          Universe {data.universeSize} · scanned {data.scanned} · {data.elapsedMs}ms · feed{" "}
          {(data.feed ?? "iex").toUpperCase()}
        </p>
      ) : (
        <p className="muted">{busy ? "Loading opportunities…" : "No discovery data yet."}</p>
      )}

      <div className="side-toggle opp-tabs" role="tablist" aria-label="Side">
        <button
          type="button"
          className={`buy ${tab === "LONG" ? "active" : ""}`}
          onClick={() => setTab("LONG")}
        >
          LONG
        </button>
        <button
          type="button"
          className={`sell ${tab === "SHORT" ? "active" : ""}`}
          onClick={() => setTab("SHORT")}
        >
          SHORT
        </button>
        <button
          type="button"
          className="btn"
          disabled={busy || rows.length === 0 || !token}
          onClick={() => void promote(rows.slice(0, 5))}
        >
          Monitor top 5
        </button>
      </div>

      <DataTable
        headers={["#", "Symbol", "Price", "Day %", "Day vol ×*", "Sector", "Score", "Action"]}
        footer={
          <p className="muted" style={{ fontSize: "0.75rem", marginTop: "0.5rem" }}>
            *Day vol × = today&apos;s volume ÷ prior day (IEX approx). Not the Scanner&apos;s RVOL. Click a symbol to open Scanner.
          </p>
        }
      >
        {rows.length === 0 ? (
          <EmptyTableRow
            cols={8}
            message={
              busy
                ? "Scanning liquid universe…"
                : "No opportunities qualified on this side — try Refresh or the other tab."
            }
          />
        ) : (
          rows.map((r, i) => (
            <tr key={`${r.side}-${r.symbol}`} className="clickable-row">
              <td>{i + 1}</td>
              <td>
                <button
                  type="button"
                  className="link-btn"
                  onClick={() => openSymbol(r.symbol, { side: r.side })}
                >
                  <strong>{r.symbol}</strong>
                </button>
              </td>
              <td>{fmtPrice(r.features?.lastPrice ?? null)}</td>
              <td className={(r.features?.dayChangePct ?? 0) >= 0 ? "chg up" : "chg down"}>
                {fmtPct(r.features?.dayChangePct)}
              </td>
              <td>
                {r.features?.rvolProxy != null ? `${r.features.rvolProxy.toFixed(2)}x` : "—"}
              </td>
              <td>{r.features?.sectorEtf ?? "—"}</td>
              <td>{r.rankScore}</td>
              <td>
                <button
                  type="button"
                  className="btn"
                  disabled={busy || !token}
                  onClick={() => void promote([r])}
                >
                  Monitor
                </button>
              </td>
            </tr>
          ))
        )}
      </DataTable>

      {data?.confirmed && data.confirmed.length > 0 ? (
        <section style={{ marginTop: "1.5rem" }}>
          <h2>Confirmation sample</h2>
          <p className="muted" style={{ fontSize: "0.85rem" }}>
            Unchanged gates (min 2R). Status from evaluateSetup — not fabricated.
          </p>
          <DataTable headers={["Symbol", "Side", "Status", "R:R", "Q10"]}>
            {data.confirmed.map((c) => (
              <tr key={`${c.side}-${c.symbol}`}>
                <td>
                  <button
                    type="button"
                    className="link-btn"
                    onClick={() => openSymbol(c.symbol, { side: c.side })}
                  >
                    {c.symbol}
                  </button>
                </td>
                <td>{c.side}</td>
                <td>
                  <StatusBadge status={c.statusLabel || c.state} />
                </td>
                <td>{c.rewardToRisk?.toFixed?.(2) ?? "—"}</td>
                <td>{c.qualityScore10 ?? "—"}</td>
              </tr>
            ))}
          </DataTable>
        </section>
      ) : null}
    </div>
  );
}
