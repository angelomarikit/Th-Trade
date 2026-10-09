import { useEffect, useState } from "react";
import { fetchCatalyst, type CatalystResponse } from "../lib/api";
import { useTerminal } from "../context/TerminalContext";
import { EmptyState } from "../components/common/EmptyState";

export function NewsPage() {
  const { symbol } = useTerminal();
  const [data, setData] = useState<CatalystResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    void fetchCatalyst(symbol)
      .then((c) => {
        setData(c);
        setError(null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  }, [symbol]);

  return (
    <div className="page">
      <h1 className="page-title">News & Catalysts</h1>
      <p className="page-sub">
        Provenance from the news service for {symbol}. News alone cannot create ENTRY ACTIVE.
      </p>

      {loading && <p className="disclaimer">Loading catalyst…</p>}
      {error && <EmptyState badge="Error" title="Catalyst unavailable" body={error} />}
      {!loading && !error && data && !data.event && (
        <EmptyState
          badge="No event"
          title="No clustered catalyst"
          body={data.why.whyMoving || "No verified catalyst for this symbol right now."}
        />
      )}
      {!loading && !error && data?.event && (
        <div className="panel">
          <div className="panel-h">
            <h3>{data.event.category}</h3>
            <span className={`badge ${data.event.verified ? "green" : "amber"}`}>
              {data.event.verified ? "Verified cluster" : "Unverified"}
            </span>
          </div>
          <div className="tab-body">
            <h2 style={{ margin: "0 0 0.5rem", fontSize: "1.05rem" }}>{data.event.headline}</h2>
            <div className="meta-row">
              <span className="badge">Source · {data.event.originalSource}</span>
              <span className="badge">
                {new Date(data.event.originalPublishedAt).toLocaleString()}
              </span>
              <span className="badge">Members {data.event.memberCount}</span>
              {data.event.priceReaction && (
                <span className="badge">{data.event.priceReaction}</span>
              )}
              <span className="badge">{data.ticker}</span>
            </div>
            <p style={{ marginTop: "0.85rem" }}>{data.why.whyMoving}</p>
          </div>
        </div>
      )}
    </div>
  );
}
