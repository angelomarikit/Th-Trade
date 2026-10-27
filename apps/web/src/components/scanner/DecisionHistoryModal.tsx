import { useCallback, useEffect, useId, useState } from "react";
import { fetchDecisionJournal, type DecisionJournalEntry } from "../../lib/api";
import { friendlyApiError } from "../../lib/apiBase";
import { formatEtTime } from "../../lib/format";
import { actionTone, decisionHistoryChanges } from "../../lib/decisionHistory";

export function DecisionHistoryLink(props: {
  symbol: string;
  side: "LONG" | "SHORT";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className={props.className ?? "decision-history-link"}
        onClick={() => setOpen(true)}
      >
        Decision history
      </button>
      {open ? (
        <DecisionHistoryModal
          symbol={props.symbol}
          side={props.side}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

function DecisionHistoryModal(props: {
  symbol: string;
  side: "LONG" | "SHORT";
  onClose: () => void;
}) {
  const titleId = useId();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<DecisionJournalEntry[]>([]);
  const [total, setTotal] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchDecisionJournal({
        symbol: props.symbol,
        side: props.side,
        limit: 120,
      });
      setTotal(res.count);
      setRows(decisionHistoryChanges(res.entries));
    } catch (err) {
      setError(friendlyApiError(err));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [props.symbol, props.side]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") props.onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [props]);

  return (
    <div className="trade-plan-overlay" role="presentation" onClick={props.onClose}>
      <div
        className="trade-plan-modal panel decision-history-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="trade-plan-modal-head">
          <div>
            <h2 id={titleId}>
              {props.symbol} {props.side} — decision history
            </h2>
            <p className="muted trade-plan-modal-sub">
              Each row is when WULU changed action, state, retest phase, or active strategy — not every
              poll.
            </p>
          </div>
          <button type="button" className="icon-btn" aria-label="Close" onClick={props.onClose}>
            ×
          </button>
        </header>

        <div className="trade-plan-modal-body">
          <p className="decision-history-intro muted">
            SKIP / WAIT / NO TRADE usually means a required gate failed (5m close, ~2R, HTF, volume,
            retest, or data freshness). Use this log to see what flipped between evaluations.
          </p>

          {loading ? (
            <p className="muted">Loading journal…</p>
          ) : error ? (
            <>
              <p className="check-fail">{error}</p>
              <button type="button" className="scan-btn" onClick={() => void load()}>
                Retry
              </button>
            </>
          ) : rows.length === 0 ? (
            <p className="muted">
              No journal rows yet for {props.symbol} {props.side}. Keep the symbol on the watchlist or
              rescan during RTH — entries appear when the decision changes.
            </p>
          ) : (
            <>
              <p className="muted" style={{ marginTop: 0, fontSize: "0.85rem" }}>
                {rows.length} change{rows.length === 1 ? "" : "s"} shown · {total} total evaluations
                stored
              </p>
              <ol className="decision-history-timeline">
                {rows.map((row, i) => {
                  const prev = rows[i + 1];
                  const action = (row.tradingAction ?? row.state ?? "—").toUpperCase();
                  return (
                    <li key={row.id} className="decision-history-item">
                      <div className="decision-history-item-head">
                        <time dateTime={row.decisionAt}>{formatEtTime(row.decisionAt)}</time>
                        <span className={`decision-history-action ${actionTone(row.tradingAction)}`}>
                          {action}
                        </span>
                      </div>
                      {prev && prev.tradingAction !== row.tradingAction ? (
                        <p className="decision-history-delta muted">
                          Action: {prev.tradingAction ?? "—"} → {row.tradingAction ?? "—"}
                        </p>
                      ) : null}
                      <p className="decision-history-status">
                        <strong>{row.statusLabel ?? row.state}</strong>
                        {row.strategyName ? (
                          <>
                            {" "}
                            · {row.strategyName}
                            {row.strategyPhase ? ` (${row.strategyPhase})` : ""}
                          </>
                        ) : null}
                      </p>
                      {row.statusReason ? (
                        <p className="muted decision-history-reason">{row.statusReason}</p>
                      ) : null}
                      {row.retestPhase ? (
                        <p className="muted decision-history-reason">
                          Retest: {row.retestPhase}
                          {row.retestReason ? ` — ${row.retestReason}` : ""}
                        </p>
                      ) : null}
                      {row.conditionsPassed != null && row.conditionsTotal != null ? (
                        <p className="muted" style={{ margin: "0.25rem 0", fontSize: "0.85rem" }}>
                          Gates {row.conditionsPassed}/{row.conditionsTotal}
                          {row.qualityScore10 != null ? ` · Quality ${row.qualityScore10}/10` : ""}
                        </p>
                      ) : null}
                      {row.blockingGates && row.blockingGates.length > 0 ? (
                        <ul className="decision-history-gates">
                          {row.blockingGates.map((g) => (
                            <li key={g.id}>
                              <span className="check-fail">{g.label}</span>
                              <span className="muted"> — {g.reason}</span>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </li>
                  );
                })}
              </ol>
            </>
          )}
        </div>

        <footer className="trade-plan-modal-foot">
          <button type="button" className="scan-btn" onClick={props.onClose}>
            Close
          </button>
        </footer>
      </div>
    </div>
  );
}
