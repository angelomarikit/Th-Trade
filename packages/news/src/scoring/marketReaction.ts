import type {
  MarketReactionContext,
  PriceReactionLabel,
  ScoreWithReasons,
} from "../types.js";

/**
 * Compare directional sentiment lean against observed price action.
 * News sentiment alone must never create ENTRY ACTIVE — this only scores alignment.
 */
export function scoreMarketReactionConfirmation(
  sentimentScore: number,
  ctx: MarketReactionContext | null | undefined,
): { confirmation: ScoreWithReasons; label: PriceReactionLabel } {
  if (!ctx || ctx.priceVsVwap === "UNKNOWN") {
    return {
      confirmation: {
        score: 0,
        reasons: ["Insufficient market reaction data"],
      },
      label: "INSUFFICIENT_DATA",
    };
  }

  const bullishNews = sentimentScore >= 25;
  const bearishNews = sentimentScore <= -25;
  const reasons: string[] = [
    `Price vs VWAP: ${ctx.priceVsVwap}`,
    `Relative volume: ${ctx.relativeVolume}`,
    `Relative strength: ${ctx.relativeStrength}`,
  ];
  if (ctx.notes?.length) reasons.push(...ctx.notes);

  let score = 50;
  let label: PriceReactionLabel = "NEUTRAL";

  const priceBullish =
    ctx.priceVsVwap === "ABOVE" &&
    (ctx.relativeVolume === "HIGH" || ctx.relativeStrength === "STRONG");
  const priceBearish =
    ctx.priceVsVwap === "BELOW" &&
    (ctx.relativeVolume === "HIGH" || ctx.relativeStrength === "WEAK");

  if (bullishNews && priceBullish) {
    score = 85;
    label = "CONFIRMING";
    reasons.push("Bullish news lean aligned with constructive price action");
  } else if (bearishNews && priceBearish) {
    score = 85;
    label = "CONFIRMING";
    reasons.push("Bearish news lean aligned with weak price action");
  } else if (bullishNews && priceBearish) {
    score = 15;
    label = "CONFLICTING";
    reasons.push(
      "Bullish headline but price below VWAP / weak tape — price action remains authoritative",
    );
  } else if (bearishNews && priceBullish) {
    score = 20;
    label = "CONFLICTING";
    reasons.push(
      "Negative headline but tape absorbing / reclaiming — possible rejection of catalyst",
    );
  } else if (bullishNews && ctx.priceVsVwap === "BELOW") {
    score = 30;
    label = "CONFLICTING";
    reasons.push("Bullish lean vs price still below VWAP");
  } else if (bearishNews && ctx.priceVsVwap === "ABOVE") {
    score = 35;
    label = "CONFLICTING";
    reasons.push("Bearish lean vs price still above VWAP");
  } else {
    reasons.push("Mixed or mild alignment between news lean and tape");
  }

  if (ctx.relativeVolume === "LOW") {
    score = Math.max(0, score - 15);
    reasons.push("Low relative volume reduces reaction confirmation (-15)");
  }

  return {
    confirmation: { score: Math.max(0, Math.min(100, score)), reasons },
    label,
  };
}
