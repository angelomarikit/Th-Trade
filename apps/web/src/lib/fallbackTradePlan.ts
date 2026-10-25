import type { SetupLiveCard, TradePlanPayload } from "./api";
import { effectiveTradingAction } from "./effectiveTradingAction";
import { buildTradePlaybook } from "./tradePlaybook";

function successRateFromLiveCard(lc: SetupLiveCard): TradePlanPayload["successRate"] {
  const edge = lc.historicalEdge;
  const sample = edge?.sampleSize ?? 0;
  const win =
    sample > 0 && edge?.winRatePct != null && Number.isFinite(edge.winRatePct)
      ? edge.winRatePct
      : null;
  let headline: string;
  if (win != null && sample >= 5) {
    headline = `Historical win rate ${win.toFixed(0)}% (${sample} similar setups)`;
  } else if (win != null && sample > 0) {
    headline = `Early sample: ${win.toFixed(0)}% win (${sample} setups — low confidence)`;
  } else {
    headline = "No matched historical sample for this pattern yet";
  }
  return {
    winRatePct: win,
    sampleSize: sample,
    strategyName: edge?.strategyName ?? null,
    expectancyR: edge?.expectancyR ?? null,
    qualityScore10: lc.qualityScore10 ?? null,
    qualityDisclaimer:
      lc.qualityScore10Disclaimer ??
      "Quality score is setup strength (1–10), not win probability. Gates still decide ENTER.",
    headline,
  };
}

function signalAction(
  side: "LONG" | "SHORT",
  tradingAction: ReturnType<typeof effectiveTradingAction>,
): TradePlanPayload["action"] {
  if (tradingAction !== "ENTER") return "WAIT";
  return side === "SHORT" ? "SELL" : "BUY";
}

/** When preview API is not yet on a build with ?plan=1, still show a WULU Plan from the setup card. */
export function fallbackTradePlanFromLiveCard(input: {
  symbol: string;
  side: "LONG" | "SHORT";
  liveCard: SetupLiveCard;
  displayPrice: number | null;
}): TradePlanPayload {
  const { symbol, side, liveCard, displayPrice } = input;
  const tradingAction = effectiveTradingAction(liveCard, side);
  const playbook = buildTradePlaybook({
    symbol,
    side,
    liveCard,
    displayAction: tradingAction,
    displayPrice,
  });
  const gatesAndNews = [playbook.newsLine, playbook.chartSessionLine].filter(Boolean).join(" ");
  return {
    symbol,
    side,
    action: signalAction(side, tradingAction),
    tradingAction,
    sections: {
      whyThisZone: playbook.whyThisZone,
      whatToDoNow: playbook.doNow,
      gatesAndNews: gatesAndNews || "See gate checklist below.",
      chartRead:
        playbook.chartSessionLine ??
        "Chart read requires WULU Plan API — redeploy preview Railway or retry after deploy.",
      risks: playbook.gatesBlocking.slice(0, 4).map((g) => `${g.label}: ${g.reason}`),
      outlook: `${liveCard.status} · follow gates before entry.`,
    },
    successRate: successRateFromLiveCard(liveCard),
    briefSource: "rules",
    gatesPassed: playbook.gatesPassed,
    gatesBlocking: playbook.gatesBlocking,
  };
}
