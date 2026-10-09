import { normalizeNewsItem } from "../normalize.js";
import type { NewsProvider } from "../NewsProvider.js";
import type { NewsItem, NewsQuery } from "../types.js";

/**
 * Offline fixture provider for tests and development without paid news calls.
 */
export class MockNewsProvider implements NewsProvider {
  readonly name = "mock";

  constructor(private readonly items: NewsItem[] = defaultMockItems()) {}

  async fetchNews(query: NewsQuery): Promise<NewsItem[]> {
    let results = this.items;
    if (query.tickers?.length) {
      const set = new Set(query.tickers.map((t) => t.toUpperCase()));
      results = results.filter((i) => i.tickers.some((t) => set.has(t)));
    }
    if (query.since) {
      results = results.filter((i) => i.publishedAt >= query.since!);
    }
    if (query.until) {
      results = results.filter((i) => i.publishedAt <= query.until!);
    }
    if (query.limit != null) {
      results = results.slice(0, query.limit);
    }
    return results;
  }
}

export function defaultMockItems(now = new Date()): NewsItem[] {
  const t = now.getTime();
  const mk = (
    id: string,
    headline: string,
    tickers: string[],
    source: string,
    minutesAgo: number,
    extras?: Partial<{ summary: string; verified: boolean }>,
  ) =>
    normalizeNewsItem({
      id,
      headline,
      summary: extras?.summary,
      tickers,
      source,
      publishedAt: new Date(t - minutesAgo * 60_000),
      receivedAt: new Date(t - (minutesAgo - 1) * 60_000),
      url: `https://example.test/news/${id}`,
      verified: extras?.verified ?? true,
      provider: "mock",
    });

  return [
    mk(
      "nvda-1",
      "NVIDIA raises guidance after earnings beat",
      ["NVDA"],
      "Reuters",
      18,
      { summary: "Company reported stronger EPS and raised full-year outlook.", verified: true },
    ),
    // Duplicates of the same story from many sites — must cluster to one event
    mk("nvda-2", "NVIDIA raises guidance after earnings beat", ["NVDA"], "CNBC", 17),
    mk("nvda-3", "Nvidia Raises Guidance After Earnings Beat", ["NVDA"], "Yahoo", 16),
    mk("nvda-4", "NVIDIA raises guidance after earnings beat", ["NVDA"], "MarketWatch", 15),
    mk(
      "amd-1",
      "AMD faces lawsuit over alleged chip defect claims",
      ["AMD"],
      "Bloomberg",
      40,
      { verified: true },
    ),
    mk(
      "spy-1",
      "Fed officials signal patience on rate decision",
      ["SPY"],
      "Associated Press",
      90,
    ),
  ];
}
