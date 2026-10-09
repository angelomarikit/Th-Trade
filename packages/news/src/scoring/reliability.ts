import type { NewsItem, ScoreWithReasons } from "../types.js";

export function scoreSourceReliability(items: NewsItem[]): ScoreWithReasons {
  if (items.length === 0) {
    return { score: 0, reasons: ["No sources"] };
  }

  const sorted = [...items].sort(
    (a, b) =>
      b.sourceReliabilityPrior - a.sourceReliabilityPrior ||
      a.publishedAt.getTime() - b.publishedAt.getTime(),
  );
  const best = sorted[0]!;
  const reasons = [
    `Earliest/highest-credibility source: ${best.source} (prior ${best.sourceReliabilityPrior})`,
  ];

  let score = best.sourceReliabilityPrior;
  if (best.verified) {
    score = Math.min(100, score + 5);
    reasons.push("Marked verified +5");
  }

  const uniqueSources = new Set(items.map((i) => i.source.toLowerCase()));
  if (uniqueSources.size > 1) {
    reasons.push(
      `${uniqueSources.size} sources in cluster; reliability taken from original/earliest credible, not majority vote`,
    );
  }

  return { score: Math.max(0, Math.min(100, score)), reasons };
}
