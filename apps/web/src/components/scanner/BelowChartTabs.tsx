import { useMemo, useState } from "react";
import { useTerminal } from "../../context/TerminalContext";
import { fmtPrice, fmtR, statusTag } from "../../lib/format";

type Tab = "overview" | "setup" | "confirmation" | "edge" | "catalysts" | "notes";
type Filter = "ALL" | "PASS" | "FAIL" | "WAIT" | "UNKNOWN";

export function BelowChartTabs() {
  const { data, notes, setNote, symbol } = useTerminal();
  const [tab, setTab] = useState<Tab>("overview");
  const [filter, setFilter] = useState<Filter>("ALL");
  const [openId, setOpenId] = useState<string | null>(null);

  const lc = data?.liveCard;
  const card = data?.card;
  const rows = card?.matrix.rows ?? [];

  const filtered = useMemo(() => {
    if (filter === "ALL") return rows;
    return rows.filter((r) => statusTag(r.status) === filter);
  }, [rows, filter]);

  const passed = lc?.conditionsPassed ?? card?.conditionsPassed ?? 0;
  const total = lc?.conditionsTotal ?? card?.conditionsTotal ?? 0;

  return (
    <section className="panel">
      <div className="tabs" role="tablist">
        {(
          [
            ["overview", "Overview"],
            ["setup", "Trade Setup"],
            ["confirmation", "Confirmation"],
            ["edge", "Historical Edge"],
            ["catalysts", "Catalysts"],
            ["notes", "Notes"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            className={tab === id ? "active" : ""}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="tab-body">
        {tab === "overview" && (
          <>
            <p style={{ marginTop: 0 }}>{lc?.whyMoving ?? "No scan loaded."}</p>
            <div className="metric-grid">
              <div>
                <label>Readiness</label>
                <strong>{lc?.status ?? "—"}</strong>
              </div>
              <div>
                <label>Conditions</label>
                <strong>
                  {passed}/{total} pass
                </strong>
              </div>
              <div>
                <label>R:R</label>
                <strong>{fmtR(lc?.rewardToRisk ?? card?.rewardToRisk)}</strong>
              </div>
              <div>
                <label>Regime</label>
                <strong>{lc?.marketRegime ?? "—"}</strong>
              </div>
            </div>
            <p className="disclaimer">{lc?.setupScoreDisclaimer}</p>
          </>
        )}

        {tab === "setup" && lc && (
          <>
            <table className="level-table">
              <thead>
                <tr>
                  <th>Level</th>
                  <th>Price</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Trigger (alert)</td>
                  <td>{fmtPrice(lc.alertAt)}</td>
                </tr>
                <tr>
                  <td>Entry zone</td>
                  <td>
                    {fmtPrice(lc.entryZone.low)} – {fmtPrice(lc.entryZone.high)}
                    {!lc.entryZone.executable ? " · not executable" : ""}
                  </td>
                </tr>
                <tr>
                  <td>Stop</td>
                  <td>{fmtPrice(lc.stop)}</td>
                </tr>
                <tr>
                  <td>Target 1</td>
                  <td>{fmtPrice(lc.t1)}</td>
                </tr>
                <tr>
                  <td>Target 2</td>
                  <td>{fmtPrice(lc.t2)}</td>
                </tr>
              </tbody>
            </table>
            <p className="disclaimer">
              Trigger ≠ entry. Levels are setup indications for Thinkorswim — no orders are submitted by
              Wulu.
            </p>
          </>
        )}

        {tab === "confirmation" && (
          <>
            <div className="cond-filters">
              {(["ALL", "PASS", "FAIL", "WAIT", "UNKNOWN"] as Filter[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  className={filter === f ? "active" : ""}
                  onClick={() => setFilter(f)}
                >
                  {f}
                  {f === "ALL" ? ` (${rows.length})` : ""}
                </button>
              ))}
            </div>
            <p className="disclaimer" style={{ marginTop: 0 }}>
              {passed} pass · WAIT is not PASS · {total} total gates
            </p>
            <ul className="cond-list">
              {filtered.map((row) => {
                const tag = statusTag(row.status);
                return (
                  <li key={row.id}>
                    <span className={`tag ${tag.toLowerCase()}`}>{tag}</span>
                    <div>
                      <div style={{ fontWeight: 600 }}>{row.label}</div>
                      <details
                        open={openId === row.id}
                        onToggle={(e) => {
                          const el = e.currentTarget;
                          setOpenId(el.open ? row.id : null);
                        }}
                      >
                        <summary>Reasoning</summary>
                        <p className="disclaimer">{row.reason}</p>
                      </details>
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}

        {tab === "edge" && (
          lc?.historicalEdge ? (
            <>
              <div className="metric-grid">
                <div>
                  <label>Strategy</label>
                  <strong>{lc.historicalEdge.strategyName}</strong>
                </div>
                <div>
                  <label>Sample</label>
                  <strong>
                    {lc.historicalEdge.sampleSize > 0
                      ? lc.historicalEdge.sampleSize
                      : "Insufficient sample"}
                  </strong>
                </div>
                <div>
                  <label>Win %</label>
                  <strong>
                    {lc.historicalEdge.winRatePct != null
                      ? `${lc.historicalEdge.winRatePct.toFixed(0)}%`
                      : "—"}
                  </strong>
                </div>
                <div>
                  <label>Expectancy</label>
                  <strong>{fmtR(lc.historicalEdge.expectancyR)}</strong>
                </div>
              </div>
              <p style={{ marginTop: "0.75rem" }}>{lc.historicalEdge.collapsedSummary}</p>
              <p className="disclaimer">{lc.historicalEdge.disclaimer}</p>
              <p className="disclaimer">Historical results do not guarantee future performance.</p>
            </>
          ) : (
            <p className="disclaimer">No historical edge attached for this scan.</p>
          )
        )}

        {tab === "catalysts" && (
          <>
            <p style={{ marginTop: 0 }}>{lc?.whyMoving ?? "—"}</p>
            <div className="meta-row">
              {lc?.catalyst && <span className="badge">{lc.catalyst}</span>}
              {lc?.priceReaction && <span className="badge">{lc.priceReaction}</span>}
              {lc?.newsAgeMinutes != null && (
                <span className="badge">{lc.newsAgeMinutes}m news age</span>
              )}
            </div>
            <p className="disclaimer">
              News alone cannot create ENTRY ACTIVE. See News & Catalysts for full provenance.
            </p>
          </>
        )}

        {tab === "notes" && (
          <>
            <textarea
              value={notes[symbol] ?? ""}
              onChange={(e) => setNote(symbol, e.target.value)}
              rows={6}
              style={{
                width: "100%",
                border: "1px solid var(--border)",
                background: "var(--bg)",
                borderRadius: 8,
                padding: "0.65rem",
                resize: "vertical",
              }}
              placeholder={`Local notes for ${symbol} (browser storage only)`}
            />
            <p className="disclaimer">Stored locally in this browser — not synced to a server account.</p>
          </>
        )}
      </div>
    </section>
  );
}
