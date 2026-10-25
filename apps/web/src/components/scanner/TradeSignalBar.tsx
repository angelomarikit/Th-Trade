import {
  ArrowUp,
  Crosshair,
  PauseCircle,
  TrendingDown,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { useTerminal } from "../../context/TerminalContext";
import { viewLiveCard } from "../../lib/scannerLiveCardView";
import { fmtPrice } from "../../lib/format";
import { hasOpenMockPosition, mockPracticeHeadline } from "../../lib/mockBuyNow";
import { normalizeStatus } from "../ui/StatusBadge";
import { setupMatchesSelectedSide } from "../../lib/setupSideSync";

/** Display labels only. Engine status and gates are unchanged. */
function signalDisplay(
  status: string,
  dataFresh: boolean,
  tradeSide: "LONG" | "SHORT",
): {
  headline: string;
  tone: string;
  Icon: LucideIcon;
} {
  if (!dataFresh || normalizeStatus(status) === "DATA NOT VERIFIED") {
    return { headline: "DATA NOT VERIFIED", tone: "tone-none", Icon: XCircle };
  }
  const n = normalizeStatus(status);
  if (n === "ENTRY ACTIVE") {
    const Icon = tradeSide === "SHORT" ? TrendingDown : ArrowUp;
    const tone = tradeSide === "SHORT" ? "tone-exit" : "tone-entry";
    return { headline: "ENTRY ACTIVE", tone, Icon };
  }
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
  const { data, side, loading, mockTradingMode, mockPortfolio, symbol } = useTerminal();
  const mockRth = data?.liveCard?.mockRth === true;
  const lc = data?.liveCard ? viewLiveCard(data.liveCard) : null;
  const sideAligned = setupMatchesSelectedSide(data, side);

  if (!lc) {
    return (
      <section className="trade-signal-bar tone-wait" aria-label="Trade signal">
        <p className="trade-signal-empty muted" style={{ margin: 0 }}>
          {loading ? "Loading setup…" : "Search a symbol for entry, stop, and targets."}
        </p>
      </section>
    );
  }

  if (!sideAligned) {
    return (
      <section className="trade-signal-bar tone-wait" aria-label="Trade signal">
        <p className="trade-signal-empty muted" style={{ margin: 0 }}>
          {loading ? `Loading ${side} setup…` : `Switch to ${side} — scan in progress.`}
        </p>
      </section>
    );
  }

  const fresh = lc.dataFresh !== false;
  const openMock = mockTradingMode && hasOpenMockPosition(mockPortfolio, symbol, side);
  const mockBuy =
    mockTradingMode && !openMock && lc.tradingAction !== "ENTER" && !data?.liveCard?.mockRth;
  let { headline, tone, Icon } = signalDisplay(lc.status, fresh, side);
  if (mockBuy) {
    headline = mockPracticeHeadline(side);
    tone = side === "LONG" ? "tone-entry" : "tone-exit";
    Icon = side === "LONG" ? ArrowUp : TrendingDown;
  }
  const score10 = lc.qualityScore10;
  const scoreLabel =
    score10 != null && Number.isFinite(score10)
      ? `${Math.round(score10)}/10`
      : "—/10";
  const entryPx =
    lc.entryZone != null ? (lc.entryZone.low + lc.entryZone.high) / 2 : lc.alertAt;
  const money = (n: number | null | undefined) => (n != null && Number.isFinite(n) ? `$${fmtPrice(n)}` : "—");
  const stale = !fresh;

  return (
    <section
      className={`trade-signal-bar ${tone}${stale ? " trade-signal-bar-stale" : ""}`}
      aria-label="Trade signal"
    >
      <div className="trade-signal-bar-top">
        <span className="trade-signal-headline">
          {headline} · {side}
        </span>
        <span className="trade-signal-icon" aria-hidden="true">
          <Icon size={18} strokeWidth={2.4} />
        </span>
      </div>
      <dl className="trade-signal-levels">
        <div>
          <dt>Entry:</dt>
          <dd>{money(entryPx)}</dd>
        </div>
        <div>
          <dt>Stop:</dt>
          <dd>{money(lc.stop)}</dd>
        </div>
        <div>
          <dt>T1:</dt>
          <dd>{money(lc.t1)}</dd>
        </div>
        <div>
          <dt>T2:</dt>
          <dd>{money(lc.t2)}</dd>
        </div>
        {lc.t3 != null ? (
          <div>
            <dt>T3:</dt>
            <dd>{money(lc.t3)}</dd>
          </div>
        ) : null}
      </dl>
      <p className="trade-signal-note">
        {mockBuy
          ? "Paper BUY NOW — tap Buy now in the panel to simulate. Not a live order."
          : stale && lc.dataFreshReason
            ? lc.dataFreshReason
            : `Setup score ${scoreLabel}. Signals only — not an order.`}
      </p>
    </section>
  );
}
