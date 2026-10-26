import type { SetupLiveCard } from "./api";
import { fmtPrice } from "./format";
import { normalizeStatus } from "../components/ui/StatusBadge";
import type { UiTradingAction } from "./effectiveTradingAction";
import { primaryStrategyName } from "./tradingRecommendation";

export interface TradePlaybook {
  headline: string;
  whyThisZone: string;
  doNow: string;
  gatesPassed: { label: string; reason: string }[];
  gatesBlocking: { label: string; reason: string; status: string }[];
  newsLine: string | null;
  chartSessionLine: string | null;
}

export function buildTradePlaybook(input: {
  symbol: string;
  side: "LONG" | "SHORT";
  liveCard: SetupLiveCard;
  displayAction: UiTradingAction;
  displayPrice: number | null;
}): TradePlaybook {
  const { symbol, side, liveCard: lc, displayAction, displayPrice } = input;
  const status = normalizeStatus(lc.status);
  const px = displayPrice ?? lc.lastPrice;
  const rows =
    lc.matrixChecklist?.filter((r) => r.requiredForEntry) ??
    [];
  const passed = rows.filter((r) => r.status === "PASS");
  const blocking = rows.filter((r) => r.status === "FAIL" || r.status === "WAITING");

  const geo = lc.entryGeometry?.summary;
  const dist = lc.nearActive?.distanceLabel;
  const inZone = lc.entryZone?.executable === true;
  const zone =
    lc.entryZone != null
      ? `${fmtPrice(lc.entryZone.low)}–${fmtPrice(lc.entryZone.high)}`
      : "—";

  const tech = lc.activeTechnique;
  let whyThisZone = tech
    ? `${tech.strategyName} (${tech.phase}): ${tech.entryTriggerDescription} ${tech.statusReason}`
    : geo ?? "";
  if (!tech && !whyThisZone && dist) {
    whyThisZone = `${side} thesis at trigger ${fmtPrice(lc.alertAt)} — price is ${dist.toLowerCase()}.`;
  }
  if (!whyThisZone) {
    whyThisZone = `Trade the ${side} setup around trigger ${fmtPrice(lc.alertAt)}; entry zone ${zone}.`;
  }
  if (px != null && Number.isFinite(px)) {
    whyThisZone += ` Chart/reference ${fmtPrice(px)}${inZone ? " (inside entry zone)" : ""}.`;
  }

  let doNow: string;
  switch (displayAction) {
    case "ENTER":
      doNow = `Rules say ENTER for ${side}: plan entry ${zone}, stop ${fmtPrice(lc.stop)}, first target ${fmtPrice(lc.t1)}. Confirm live quote and size before any order — signal only.`;
      break;
    case "SKIP":
      doNow =
        lc.watchingSummary ??
        (status.includes("MISSED")
          ? "Do not chase — price left the executable zone or setup closed."
          : "No new entry — skip this signal and wait for the next evaluation.");
      break;
    case "INVALIDATED":
      doNow = "Stand aside — stop/structure invalidation. Do not re-enter this setup without a fresh scan.";
      break;
    default:
      doNow = tech
        ? `WAIT — ${tech.strategyName} (${tech.phase}). ${tech.statusReason} ${blocking[0]?.reason ?? lc.waitingFor?.[0] ?? ""}`.trim()
        : blocking[0]?.reason ??
          lc.waitingFor?.[0] ??
          lc.watchingSummary ??
          `Wait — required gates not all PASS (${passed.length}/${rows.length || "—"}).`;
  }

  if (lc.labMockEnterAuthorizedSide && lc.labMockEnterAuthorizedSide !== side) {
    doNow = `Lab replay: only ${lc.labMockEnterAuthorizedSide} may ENTER on this snapshot. Stay flat on ${side} or switch direction and rescan.`;
  }

  const catalyst = lc.catalyst?.trim();
  const why = lc.whyMoving?.trim();
  let newsLine: string | null = null;
  if (catalyst || why) {
    const age =
      lc.newsAgeMinutes != null && lc.newsAgeMinutes < 999
        ? ` (~${lc.newsAgeMinutes}m ago)`
        : "";
    newsLine = `${catalyst ? catalyst + age : ""}${why && why !== catalyst ? (catalyst ? " — " : "") + why : ""}. News is context only — never authorizes entry alone.`;
  }

  const rr = lc.rewardToRisk;
  const session = lc.session?.session ?? "—";
  const strat = primaryStrategyName(lc);
  const chartSessionLine = [
    `Session ${session}${lc.dataFresh ? " · data verified" : " · data not verified"}`,
    rr != null && Number.isFinite(rr) ? `R:R ${rr.toFixed(2)} to T1 (need ~2R for live ENTER)` : null,
    strat ? `Pattern: ${strat}` : null,
    lc.marketRegime ? `Regime: ${lc.marketRegime}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return {
    headline: `${symbol} ${side} — where & why`,
    whyThisZone,
    doNow,
    gatesPassed: passed.map((r) => ({ label: r.label, reason: r.reason })),
    gatesBlocking: blocking.map((r) => ({
      label: r.label,
      reason: r.reason,
      status: r.status,
    })),
    newsLine,
    chartSessionLine,
  };
}
