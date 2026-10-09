import type { NewsItem, ScoreWithReasons } from "../types.js";

/**
 * Freshness 0–100 based on age of earliest publish time in cluster.
 * Half-life style decay after 30 minutes.
 */
export function scoreNewsFreshness(
  items: NewsItem[],
  now: Date = new Date(),
): ScoreWithReasons {
  if (items.length === 0) {
    return { score: 0, reasons: ["No items"] };
  }

  const earliest = items.reduce(
    (min, i) => (i.publishedAt < min ? i.publishedAt : min),
    items[0]!.publishedAt,
  );
  const ageMs = Math.max(0, now.getTime() - earliest.getTime());
  const ageMin = ageMs / 60_000;

  let score: number;
  let band: string;
  if (ageMin <= 15) {
    score = 100;
    band = "≤15m";
  } else if (ageMin <= 30) {
    score = 90;
    band = "≤30m";
  } else if (ageMin <= 60) {
    score = 75;
    band = "≤60m";
  } else if (ageMin <= 120) {
    score = 55;
    band = "≤2h";
  } else if (ageMin <= 240) {
    score = 35;
    band = "≤4h";
  } else if (ageMin <= 1440) {
    score = 15;
    band = "≤24h";
  } else {
    score = 5;
    band = ">24h";
  }

  return {
    score,
    reasons: [`News age ${ageMin.toFixed(1)} minutes (${band})`, `Earliest publish ${earliest.toISOString()}`],
  };
}
