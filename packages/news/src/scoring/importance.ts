import type { CatalystCategory } from "../categories.js";
import type { NewsItem, ScoreWithReasons } from "../types.js";

const CATEGORY_WEIGHT: Record<CatalystCategory, number> = {
  EARNINGS: 90,
  GUIDANCE: 88,
  MA: 92,
  FDA: 90,
  FORM_8K: 80,
  FORM_10Q: 70,
  FORM_10K: 65,
  SEC_FILING: 72,
  ANALYST_UPGRADE: 60,
  ANALYST_DOWNGRADE: 60,
  PRICE_TARGET_CHANGE: 55,
  REGULATORY: 78,
  LAWSUIT: 75,
  GOVERNMENT_CONTRACT: 70,
  PRODUCT_ANNOUNCEMENT: 58,
  PARTNERSHIP: 55,
  MANAGEMENT_CHANGE: 68,
  SHARE_OFFERING: 72,
  BUYBACK: 60,
  DIVIDEND: 45,
  STOCK_SPLIT: 50,
  INSIDER_ACTIVITY: 48,
  MACRO: 70,
  FED: 85,
  CPI: 80,
  PPI: 72,
  JOBS: 78,
  RATE_DECISION: 88,
  GEOPOLITICAL: 65,
  SECTOR_NEWS: 50,
  OTHER: 35,
};

export function scoreCatalystImportance(items: NewsItem[]): ScoreWithReasons {
  if (items.length === 0) {
    return { score: 0, reasons: ["No news items in cluster"] };
  }

  const primary = pickPrimary(items);
  const base = CATEGORY_WEIGHT[primary.category];
  const reasons = [`Category ${primary.category} base weight ${base}`];

  let score = base;
  if (primary.verified) {
    score = Math.min(100, score + 5);
    reasons.push("Verified source bonus +5");
  }
  if (primary.summary && primary.summary.length > 80) {
    score = Math.min(100, score + 2);
    reasons.push("Substantive summary present +2");
  }

  // Duplicates do NOT increase importance
  if (items.length > 1) {
    reasons.push(
      `Cluster size ${items.length} ignored for importance (deduped; no repetition boost)`,
    );
  }

  return { score: clamp(score, 0, 100), reasons };
}

function pickPrimary(items: NewsItem[]): NewsItem {
  return [...items].sort(
    (a, b) =>
      b.sourceReliabilityPrior - a.sourceReliabilityPrior ||
      a.publishedAt.getTime() - b.publishedAt.getTime(),
  )[0]!;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
