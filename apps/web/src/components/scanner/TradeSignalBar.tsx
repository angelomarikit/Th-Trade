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

function mobileHeadline(status: string): string {
  const n = normalizeStatus(status);
  if (n === "NEAR ACTIVE") return "WATCH CLOSELY";
  if (n.includes("TARGET HIT") || n.includes("STOP HIT")) return "EXIT NOW";
  if (n === "INVALIDATED" || n === "MISSED") return "EXIT NOW";
  return n;
}

function barTone(status: string): string {
  const u = status.toUpperCase();
  if (u.includes("ENTRY ACTIVE")) return "tone-entry";
  if (u.includes("NEAR ACTIVE") || u.includes("WATCH")) return "tone-watch";
  if (u.includes("TARGET HIT")) return "tone-manage";
  if (u.includes("STOP HIT") || u.includes("INVALIDATED") || u.includes("MISSED")) return "tone-exit";
  if (u.includes("NO TRADE") || u.includes("DATA NOT VERIFIED")) return "tone-none";
  return "tone-wait";
}

function barIcon(status: string): LucideIcon {
  const u = status.toUpperCase();
  if (u.includes("ENTRY ACTIVE")) return TrendingUp;
  if (u.includes("NEAR ACTIVE") || u.includes("WATCH")) return Crosshair;
  if (u.includes("TARGET HIT")) return PauseCircle;
  if (u.includes("STOP HIT") || u.includes("INVALIDATED") || u.includes("MISSED")) return TrendingDown;
  if (u.includes("NO TRADE") || u.includes("DATA NOT VERIFIED")) return XCircle;
  return Crosshair;
}

/** Mobile-first trade signal strip — levels mirror setup engine output (display only). */
export function TradeSignalBar() {
  const { data, symbol, side, loading } = useTerminal();
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

  const headline = mobileHeadline(lc.status);
  const Icon = barIcon(lc.status);
  const tone = barTone(lc.status);
  const score10 = lc.qualityScore10 ?? lc.nearActive?.setupQualityScore ?? null;
  const scoreLabel =
    score10 != null && Number.isFinite(score10)
      ? `${Math.round(score10)}/10 SETUP SCORE`
      : lc.setupScoreValue != null
        ? `${lc.setupScoreValue}/100 SCORE`
        : null;
  const entryMid =
    lc.entryZone != null ? (lc.entryZone.low + lc.entryZone.high) / 2 : lc.alertAt;
  const stale = lc.dataFresh === false;

  return (
    <section
      className={`trade-signal-bar ${tone}${stale ? " trade-signal-bar-stale" : ""}`}
      aria-label="Trade signal"
    >
      <div className="trade-signal-bar-top">
        <div className="trade-signal-bar-status">
          <Icon size={20} strokeWidth={2.25} aria-hidden />
          <span className="trade-signal-headline">{stale ? "DATA NOT VERIFIED" : headline}</span>
        </div>
        {scoreLabel ? <span className="trade-signal-score">{scoreLabel}</span> : null}
      </div>
      <p className="trade-signal-direction">{side}</p>
      <dl className="trade-signal-levels">
        <div>
          <dt>Entry</dt>
          <dd>{entryMid != null ? fmtPrice(entryMid) : "—"}</dd>
        </div>
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
        {lc.t3 != null ? (
          <div>
            <dt>Target 3</dt>
            <dd>{fmtPrice(lc.t3)}</dd>
          </div>
        ) : null}
      </dl>
      {stale && lc.dataFreshReason ? (
        <p className="trade-signal-note">{lc.dataFreshReason}</p>
      ) : (
        <p className="trade-signal-note trade-signal-symbol">{symbol} · display only — not an order</p>
      )}
    </section>
  );
}
