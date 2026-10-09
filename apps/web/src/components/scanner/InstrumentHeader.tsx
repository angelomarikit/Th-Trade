import { Star } from "lucide-react";
import { useTerminal } from "../../context/TerminalContext";
import { ageLabel, fmtPct, fmtPrice } from "../../lib/format";

export function InstrumentHeader() {
  const {
    symbol,
    side,
    setSide,
    scan,
    loading,
    data,
    bars,
    updatedAt,
    watchlist,
    toggleWatchlist,
  } = useTerminal();

  const lc = data?.liveCard;
  const last = lc?.lastPrice ?? data?.card.lastPrice;
  const first = bars?.bars[0]?.close;
  const lastBar = bars?.bars.at(-1)?.close;
  const chg =
    first != null && lastBar != null && first !== 0
      ? ((lastBar - first) / first) * 100
      : null;
  const session = lc?.session ?? data?.card.session;
  const score = lc?.setupScoreValue ?? data?.card.setupScore.total;
  const fresh = lc?.dataFresh ?? data?.card.dataFresh;
  const starred = watchlist.includes(symbol);

  return (
    <section className="panel instrument">
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.55rem", flexWrap: "wrap" }}>
          <h1>{symbol}</h1>
          <span className={`badge ${side === "LONG" ? "green" : "red"}`}>{side}</span>
          <button
            type="button"
            className="icon-btn"
            onClick={() => toggleWatchlist(symbol)}
            title={starred ? "Remove from local watchlist" : "Add to local watchlist"}
            aria-label="Toggle watchlist"
          >
            <Star size={14} fill={starred ? "currentColor" : "none"} />
          </button>
        </div>
        <div className="meta-row">
          <span className={`badge ${statusClass(lc?.status ?? "")}`}>{lc?.status ?? "—"}</span>
          {session && (
            <span className="badge" title={session.reason}>
              {session.session}
              {session.tightenConfirmation ? " · TIGHT" : ""}
            </span>
          )}
          <span className={`badge ${fresh ? "green" : "amber"}`}>
            DATA {fresh ? "FRESH" : "NOT VERIFIED"}
          </span>
          <span className="badge" title="Setup score is not win probability">
            SCORE {score ?? "—"}/100
          </span>
          {lc?.marketRegime && <span className="badge blue">{lc.marketRegime}</span>}
          {lc?.market && <span className="badge">{lc.market}</span>}
          <span className="badge">UPD {ageLabel(updatedAt)}</span>
        </div>
        <div className="scan-controls" style={{ marginTop: "0.75rem" }}>
          <div className="side-toggle" role="group" aria-label="Direction">
            <button
              type="button"
              className={`buy ${side === "LONG" ? "active" : ""}`}
              onClick={() => setSide("LONG")}
            >
              BUY
            </button>
            <button
              type="button"
              className={`sell ${side === "SHORT" ? "active" : ""}`}
              onClick={() => setSide("SHORT")}
            >
              SELL
            </button>
          </div>
          <button
            type="button"
            className="scan-btn"
            disabled={loading}
            onClick={() => void scan({ ticker: symbol, side, brief: true })}
          >
            {loading ? "Scanning…" : "Scan"}
          </button>
        </div>
        {data?.signalRecommendation && (
          <div className="meta-row" style={{ marginTop: "0.65rem" }}>
            <span
              className={`badge ${
                data.signalRecommendation.action === "BUY"
                  ? "green"
                  : data.signalRecommendation.action === "SELL"
                    ? "red"
                    : "amber"
              }`}
              title="Automatic Signal Recommendation"
            >
              SIGNAL · {data.signalRecommendation.action}
            </span>
          </div>
        )}
      </div>
      <div>
        <div className={`last ${side === "LONG" ? "side-long" : "side-short"}`}>{fmtPrice(last)}</div>
        <div className={`chg ${chg != null && chg >= 0 ? "up" : "down"}`} title="Change across loaded chart window — not official day change">
          {fmtPct(chg)} <span style={{ color: "var(--muted)" }}>chart window</span>
        </div>
      </div>
    </section>
  );
}

function statusClass(status: string): string {
  if (status.includes("ENTRY ACTIVE")) return "green";
  if (status.includes("NEAR ACTIVE")) return "amber";
  if (status.includes("MISSED")) return "red";
  if (status.includes("DATA")) return "amber";
  return "";
}
