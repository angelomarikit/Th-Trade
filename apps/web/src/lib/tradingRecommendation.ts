import type { MonitorSymbolState, SetupLiveCard } from "./api";
import { fmtPrice } from "./format";
import { normalizeStatus } from "../components/ui/StatusBadge";

export function primaryStrategyName(lc: SetupLiveCard): string | null {
  return (
    lc.activeTechnique?.strategyName ??
    lc.matchedStrategies?.[0]?.strategyName ??
    lc.matchedStrategies?.[0]?.strategyId ??
    null
  );
}

/** Plain-English assistant copy from the same setup card the chart uses. */
export function buildTradingBrief(input: {
  symbol: string;
  side: "LONG" | "SHORT";
  liveCard: SetupLiveCard;
  displayPrice: number | null;
}): string[] {
  const { symbol, side, liveCard: lc, displayPrice } = input;
  const status = normalizeStatus(lc.status);
  const px = displayPrice ?? lc.lastPrice;
  const lines: string[] = [];

  lines.push(`${symbol} — ${side} SETUP — ${status}`);
  if (px != null && Number.isFinite(px)) {
    lines.push(`Current price: ${fmtPrice(px)}${lc.dataFresh ? "" : " (data not verified for trading)"}`);
  }

  const waiting =
    lc.nearActive?.stillWaitingFor?.length ? lc.nearActive.stillWaitingFor : lc.waitingFor ?? [];
  const confirm = waiting[0] ?? lc.nearActive?.confirmationRequirement;
  if (status.includes("WAIT") || status.includes("NEAR")) {
    lines.push(
      confirm ??
        `Watch for a completed 5-minute candle ${side === "LONG" ? "above" : "below"} ${fmtPrice(lc.alertAt)} with sufficient volume.`,
    );
  } else if (status.includes("ENTRY")) {
    lines.push("Mandatory confirmation checks passed on the last completed bars — still not an automatic order.");
  } else if (status.includes("INVALIDATED")) {
    lines.push("INVALIDATED — DO NOT ENTER. Structure, stop, or confirmation failed.");
  } else if (status.includes("MISSED")) {
    lines.push("MISSED — DO NOT CHASE. Price moved beyond the executable entry zone.");
  } else if (status.includes("NO TRADE") || status.includes("DATA NOT VERIFIED")) {
    lines.push(waiting[0] ?? "Mandatory requirements are not met or data is not fresh enough.");
  }

  lines.push(
    `Entry: ${fmtPrice(lc.entryZone.low)}–${fmtPrice(lc.entryZone.high)}${lc.entryZone.executable ? "" : " (not executable at current price)"}.`,
  );
  lines.push(`Stop: ${fmtPrice(lc.stop)}.`);
  const t3 = lc.t3 != null ? ` / ${fmtPrice(lc.t3)}` : "";
  lines.push(`Targets: ${fmtPrice(lc.t1)} / ${fmtPrice(lc.t2)}${t3}.`);

  const rr = lc.rewardToRisk;
  if (rr != null && Number.isFinite(rr)) {
    lines.push(`Reward : risk ${rr.toFixed(2)}R to Target 1 (minimum ~2R required for entry).`);
  }

  const strat = primaryStrategyName(lc);
  if (strat) lines.push(`Strategy: ${strat}.`);
  if (lc.activeTechnique) {
    lines.push(`Phase: ${lc.activeTechnique.phase} — ${lc.activeTechnique.statusReason}`);
    lines.push(`Trigger: ${lc.activeTechnique.entryTriggerDescription}`);
    lines.push(`Context: ${lc.activeTechnique.trendContext}`);
    if (lc.activeTechnique.invalidationRules.length) {
      lines.push(`Invalidation: ${lc.activeTechnique.invalidationRules[0]}`);
    }
  }

  if (status.includes("WAIT") && lc.nearActive?.distanceLabel) {
    lines.push(`Status: ${status} — ${lc.nearActive.distanceLabel.toLowerCase()}.`);
  } else {
    lines.push(`Status: ${status}.`);
  }

  return lines;
}

/** Watchlist monitor row — same fields as server scan, no chart required. */
export function buildWatchlistBrief(row: MonitorSymbolState): string[] {
  const status = normalizeStatus(row.statusLabel || row.status);
  const lines: string[] = [];
  const tradeDir =
    status.includes("NO TRADE") || status.includes("DATA NOT VERIFIED")
      ? "NO TRADE"
      : row.side;

  lines.push(`${row.symbol} — ${tradeDir} — ${status}`);
  lines.push(
    `Current price: ${fmtPrice(row.lastPrice)}${row.dataFresh ? " (verified)" : " (not verified for trading)"}`,
  );

  const wait = row.waitingFor[0] ?? row.actionHint;
  if (wait) lines.push(wait);

  if (!row.dataFresh) {
    lines.push("Do not act on entry levels until data is verified.");
  }

  lines.push(`Trigger ${fmtPrice(row.alertAt)} · Entry ${fmtPrice(row.entryZone?.low)}–${fmtPrice(row.entryZone?.high)}`);
  lines.push(`Stop ${fmtPrice(row.stop)} · Targets ${fmtPrice(row.t1)} / ${fmtPrice(row.t2)} / ${fmtPrice(row.target3)}`);
  if (row.rewardToRisk != null) {
    lines.push(`Reward : risk ${row.rewardToRisk.toFixed(2)}R · Setup score ${row.qualityScore10 ?? row.setupScore ?? "—"}/10`);
  }
  if (row.strategyName) lines.push(`Strategy: ${row.strategyName}`);
  return lines;
}
