import {
  Crosshair,
  PauseCircle,
  TrendingDown,
  TrendingUp,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { useTerminal } from "../../context/TerminalContext";
import { viewLiveCard } from "../../lib/scannerLiveCardView";
import { fmtPrice } from "../../lib/format";
import { normalizeStatus } from "../ui/StatusBadge";

/** Display labels only. Engine status and gates are unchanged. */
function signalDisplay(status: string, dataFresh: boolean): {
  headline: string;
  tone: string;
  Icon: LucideIcon;
} {
  if (!dataFresh || normalizeStatus(status) === "DATA NOT VERIFIED") {
    return { headline: "DATA NOT VERIFIED", tone: "tone-none", Icon: XCircle };
  }
  const n = normalizeStatus(status);
  if (n === "ENTRY ACTIVE") return { headline: "ENTRY ACTIVE", tone: "tone-entry", Icon: TrendingUp };
  if (n === "NEAR ACTIVE" || n === "WATCH") return { headline: "WATCH CLOSELY", tone: "tone-watch", Icon: Crosshair };
  if (n.includes("TARGET HIT")) return { headline: "MANAGE TRADE", tone: "tone-manage", Icon: PauseCircle };
  if (n.includes("STOP HIT") || n === "INVALIDATED" || n === "MISSED") {
    return { headline: "EXIT / STOP HIT", tone: "tone-exit", Icon: TrendingDown };
  }
  if (n === "NO TRADE") return { headline: "NO TRADE", tone: "tone-none", Icon: XCircle };
  if (n === "WAIT") return { headline: "WAIT", tone: "tone-wait", Icon: Crosshair };
  return { headline: n, tone: "tone-wait", Icon: Crosshair };
}

/** Mobile-first trade signal strip — levels mirror setup engine output (display only). */
export function TradeSignalBar() {
  const { data, side, loading } = useTerminal();
  const lc = data?.liveCard ? viewLiveCard(data.liveCard) : null;

  if (!lc) {
    return (
      <section className="trade-signal-bar tone-wait" aria-label="Trade signal">
        <p className="trade-signal-empty muted" style={{ margin: 0 }}>
          {loading ? "Loading setup…" : "Search a symbol for entry, stop, and targets."}
        </p>
      </section>
    );
  }

  const fresh = lc.dataFresh !== false;
  const { headline, tone, Icon } = signalDisplay(lc.status, fresh);
  const score10 = lc.qualityScore10;
  const scoreLabel =
    score10 != null && Number.isFinite(score10)
      ? `${Math.round(score10)}/10`
      : "—/10";
  const entryLabel =
    lc.entryZone != null
      ? `${fmtPrice(lc.entryZone.low)} – ${fmtPrice(lc.entryZone.high)}`
      : lc.alertAt != null
        ? fmtPrice(lc.alertAt)
        : "—";
  const stale = !fresh;

  return (
    <section
      className={`trade-signal-bar ${tone}${stale ? " trade-signal-bar-stale" : ""}`}
      aria-label="Trade signal"
    >
      <div className="trade-signal-bar-top">
        <div className="trade-signal-bar-status">
          <Icon size={20} strokeWidth={2.25} aria-hidden />
          <span className="trade-signal-headline">{stale ? "DATA NOT VERIFIED" : headline}</span>
          <span className="trade-signal-direction">{side}</span>
        </div>
        <span className="trade-signal-score">
          <b>{scoreLabel}</b>
          <span>SETUP SCORE</span>
        </span>
      </div>
      <div className="trade-signal-entry">
        <span>Entry zone</span>
        <strong>{entryLabel}</strong>
      </div>
      <dl className="trade-signal-levels">
        <div>
          <dt>Stop loss</dt>
          <dd className="level-stop">{fmtPrice(lc.stop)}</dd>
        </div>
        <div>
          <dt>Target 1</dt>
          <dd className="level-t1">{fmtPrice(lc.t1)}</dd>
        </div>
        <div>
          <dt>Target 2</dt>
          <dd className="level-t2">{fmtPrice(lc.t2)}</dd>
        </div>
        <div>
          <dt>Target 3</dt>
          <dd>{lc.t3 != null ? fmtPrice(lc.t3) : "—"}</dd>
        </div>
      </dl>
      {stale && lc.dataFreshReason ? <p className="trade-signal-note">{lc.dataFreshReason}</p> : null}
    </section>
  );
}
