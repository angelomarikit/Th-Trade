import { useEffect, useState } from "react";
import { fetchCatalyst, type CatalystResponse } from "../lib/api";
import { useTerminal } from "../context/TerminalContext";
import { EmptyState } from "../components/common/EmptyState";

export function NewsPage() {
  const { symbol, data } = useTerminal();
  const [catalyst, setCatalyst] = useState<CatalystResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    void fetchCatalyst(symbol)
      .then((c) => {
        setCatalyst(c);
        setError(null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  }, [symbol]);

  const why = catalyst?.why ?? data?.card.whyMoving;
  const event = catalyst?.event ?? null;
  const reaction =
    event?.priceReaction ?? why?.priceReaction ?? data?.liveCard.priceReaction ?? "UNKNOWN";

  return (
    <div className="page">
      <h1 className="page-title">News & Catalysts</h1>
      <p className="page-sub">
        Provider-agnostic catalyst panel for {symbol}. Headlines are never invented. News alone
        cannot create ENTRY ACTIVE.
      </p>

      {loading && <p className="disclaimer">Loading catalyst…</p>}
      {error && <EmptyState badge="Error" title="Catalyst unavailable" body={error} />}

      {!loading && !error && (
        <section className="panel catalyst-panel">
          <div className="panel-h">
            <h3>WHY IS IT MOVING?</h3>
            <span className={`badge ${why?.hasVerifiedCatalyst ? "green" : "amber"}`}>
              {why?.hasVerifiedCatalyst ? "Verified" : "No verified catalyst"}
            </span>
          </div>
          <div className="tab-body">
            <dl className="catalyst-dl">
              <div>
                <dt>WHY MOVING</dt>
                <dd>{why?.whyMoving ?? "NO VERIFIED NEWS CATALYST FOUND"}</dd>
              </div>
              <div>
                <dt>NEWS CATALYST</dt>
                <dd>{why?.catalystLabel ?? event?.category ?? "—"}</dd>
              </div>
              <div>
                <dt>NEWS TIME</dt>
                <dd>
                  {event?.originalPublishedAt
                    ? new Date(event.originalPublishedAt).toLocaleString()
                    : why?.newsAgeMinutes != null
                      ? `${why.newsAgeMinutes} min ago`
                      : "—"}
                </dd>
              </div>
              <div>
                <dt>MARKET REACTION</dt>
                <dd className={reactionClass(reaction)}>{formatReaction(reaction)}</dd>
              </div>
            </dl>

            <p className="disclaimer">
              Bullish headlines never independently activate a long. Confirmed price action controls
              execution. Duplicate stories are clustered by the news service.
            </p>
          </div>
        </section>
      )}

      {!loading && !error && event && (
        <div className="panel" style={{ marginTop: "0.85rem" }}>
          <div className="panel-h">
            <h3>{event.category}</h3>
            <span className={`badge ${event.verified ? "green" : "amber"}`}>
              {event.verified ? "Verified cluster" : "Unverified"}
            </span>
          </div>
          <div className="tab-body">
            <h2 style={{ margin: "0 0 0.5rem", fontSize: "1.05rem" }}>{event.headline}</h2>
            <div className="meta-row">
              <span className="badge">Source · {event.originalSource}</span>
              <span className="badge">{new Date(event.originalPublishedAt).toLocaleString()}</span>
              <span className="badge">Cluster members {event.memberCount}</span>
              <span className="badge">{symbol}</span>
            </div>
          </div>
        </div>
      )}

      {!loading && !error && !event && why && !why.hasVerifiedCatalyst && (
        <EmptyState
          badge="No event"
          title="No clustered catalyst"
          body="Deterministic fixtures or live feed returned no verified catalyst for this ticker."
        />
      )}
    </div>
  );
}

function formatReaction(r: string): string {
  const u = r.toUpperCase();
  if (u.includes("CONFIRM")) return "CONFIRMING";
  if (u.includes("CONFLICT")) return "CONFLICTING";
  return "UNKNOWN";
}

function reactionClass(r: string): string {
  const f = formatReaction(r);
  if (f === "CONFIRMING") return "up";
  if (f === "CONFLICTING") return "down";
  return "";
}
