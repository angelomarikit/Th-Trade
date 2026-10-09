import {
  NO_VERIFIED_CATALYST_MESSAGE,
  type CatalystEvent,
  type PriceReactionLabel,
  type WhyMovingBlock,
} from "./types.js";

export function buildWhyMoving(event: CatalystEvent | null): WhyMovingBlock {
  if (!event) {
    return {
      whyMoving: NO_VERIFIED_CATALYST_MESSAGE,
      catalystLabel: null,
      newsAgeMinutes: null,
      priceReaction: null,
      hasVerifiedCatalyst: false,
    };
  }

  const ageMs = Date.now() - event.originalPublishedAt.getTime();
  const newsAgeMinutes = Math.max(0, Math.round(ageMs / 60_000));
  const lean = event.scores.directionalSentiment.score;
  const impact =
    event.scores.catalystImportance.score >= 75
      ? "HIGH IMPACT"
      : event.scores.catalystImportance.score >= 50
        ? "MODERATE IMPACT"
        : "LOW IMPACT";
  const direction =
    lean >= 25 ? "BULLISH" : lean <= -25 ? "BEARISH" : "NEUTRAL";

  return {
    whyMoving: summarizeHeadline(event.headline, event.category),
    catalystLabel: `${impact} ${direction}`,
    newsAgeMinutes,
    priceReaction: event.priceReaction,
    hasVerifiedCatalyst: true,
  };
}

function summarizeHeadline(headline: string, category: string): string {
  const trimmed = headline.trim();
  if (trimmed.length <= 120) return trimmed;
  return `${trimmed.slice(0, 117)}... [${category}]`;
}

export function formatWhyMovingBlock(block: WhyMovingBlock): string {
  const lines = [`WHY MOVING:`, block.whyMoving];
  if (block.catalystLabel) {
    lines.push(`CATALYST:`, block.catalystLabel);
  }
  if (block.newsAgeMinutes != null) {
    lines.push(`NEWS AGE:`, `${block.newsAgeMinutes} MIN`);
  }
  if (block.priceReaction) {
    lines.push(`PRICE REACTION:`, block.priceReaction);
  }
  return lines.join("\n");
}

export function reactionLabelOrNull(
  label: PriceReactionLabel | null | undefined,
): PriceReactionLabel | null {
  return label ?? null;
}
