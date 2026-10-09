import type { NewsItem, NewsQuery } from "./types.js";

/**
 * Provider-agnostic news interface.
 * Implementations must use licensed/official APIs — no ToS-violating scraping.
 */
export interface NewsProvider {
  readonly name: string;
  fetchNews(query: NewsQuery): Promise<NewsItem[]>;
}

export interface NewsProviderHealth {
  provider: string;
  ok: boolean;
  detail?: string;
}
