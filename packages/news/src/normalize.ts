import { categoryToEventType, classifyCategory, type CatalystCategory } from "./categories.js";
import type { NewsItem } from "./types.js";

export interface RawNewsInput {
  id: string;
  headline: string;
  summary?: string;
  tickers?: string[];
  symbols?: string[];
  source: string;
  publishedAt: string | Date;
  receivedAt?: string | Date;
  url?: string;
  category?: CatalystCategory;
  verified?: boolean;
  sourceReliabilityPrior?: number;
  company?: string;
  sector?: string;
  provider: string;
  raw?: unknown;
}

const SOURCE_RELIABILITY: Record<string, number> = {
  "business wire": 85,
  "pr newswire": 85,
  reuters: 90,
  bloomberg: 90,
  "associated press": 88,
  ap: 88,
  "dow jones": 88,
  cnbc: 75,
  "marketwatch": 70,
  yahoo: 55,
  seekingalpha: 50,
  alpaca: 70,
  mock: 60,
};

export function reliabilityForSource(source: string): number {
  const key = source.trim().toLowerCase();
  if (SOURCE_RELIABILITY[key] != null) return SOURCE_RELIABILITY[key];
  for (const [name, score] of Object.entries(SOURCE_RELIABILITY)) {
    if (key.includes(name)) return score;
  }
  return 50;
}

export function normalizeNewsItem(input: RawNewsInput): NewsItem {
  const headline = input.headline.trim();
  const summary = input.summary?.trim();
  const tickers = uniqueTickers(input.tickers ?? input.symbols ?? []);
  const category = input.category ?? classifyCategory(headline, summary);
  const publishedAt = toDate(input.publishedAt);
  const receivedAt = input.receivedAt ? toDate(input.receivedAt) : new Date();

  return {
    id: String(input.id),
    headline,
    summary,
    tickers,
    source: input.source.trim(),
    publishedAt,
    receivedAt,
    url: input.url,
    category,
    eventType: categoryToEventType(category),
    verified: input.verified ?? false,
    sourceReliabilityPrior: input.sourceReliabilityPrior ?? reliabilityForSource(input.source),
    company: input.company,
    sector: input.sector,
    provider: input.provider,
    raw: input.raw,
  };
}

function uniqueTickers(tickers: string[]): string[] {
  const set = new Set(
    tickers
      .map((t) => t.trim().toUpperCase())
      .filter((t) => /^[A-Z][A-Z0-9.-]{0,11}$/.test(t)),
  );
  return [...set].sort();
}

function toDate(value: string | Date): Date {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`Invalid date: ${String(value)}`);
  }
  return d;
}
