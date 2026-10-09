import { normalizeNewsItem } from "../normalize.js";
import type { NewsProvider } from "../NewsProvider.js";
import type { NewsItem, NewsQuery } from "../types.js";

export interface AlpacaNewsConfig {
  apiKeyId: string;
  apiSecretKey: string;
  /** Default: https://data.alpaca.markets */
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

interface AlpacaNewsArticle {
  id: number | string;
  headline: string;
  summary?: string;
  author?: string;
  created_at: string;
  updated_at?: string;
  url?: string;
  symbols?: string[];
  source?: string;
}

interface AlpacaNewsResponse {
  news?: AlpacaNewsArticle[];
  next_page_token?: string | null;
}

/**
 * Official Alpaca News API adapter (licensed data feed).
 * Does not scrape websites.
 */
export class AlpacaNewsProvider implements NewsProvider {
  readonly name = "alpaca";
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly config: AlpacaNewsConfig) {
    if (!config.apiKeyId || !config.apiSecretKey) {
      throw new Error("AlpacaNewsProvider requires ALPACA_API_KEY_ID and ALPACA_API_SECRET_KEY");
    }
    this.baseUrl = (config.baseUrl ?? "https://data.alpaca.markets").replace(/\/$/, "");
    this.fetchImpl = config.fetchImpl ?? fetch;
  }

  async fetchNews(query: NewsQuery): Promise<NewsItem[]> {
    const params = new URLSearchParams();
    if (query.tickers?.length) params.set("symbols", query.tickers.join(","));
    if (query.since) params.set("start", query.since.toISOString());
    if (query.until) params.set("end", query.until.toISOString());
    params.set("limit", String(query.limit ?? 50));
    params.set("include_content", "false");
    params.set("exclude_contentless", "true");

    const url = `${this.baseUrl}/v1beta1/news?${params.toString()}`;
    const res = await this.fetchImpl(url, {
      headers: {
        "APCA-API-KEY-ID": this.config.apiKeyId,
        "APCA-API-SECRET-KEY": this.config.apiSecretKey,
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Alpaca news HTTP ${res.status}: ${body.slice(0, 200)}`);
    }

    const data = (await res.json()) as AlpacaNewsResponse;
    const receivedAt = new Date();
    return (data.news ?? []).map((article) =>
      normalizeNewsItem({
        id: String(article.id),
        headline: article.headline,
        summary: article.summary,
        tickers: article.symbols ?? [],
        source: article.source ?? "alpaca",
        publishedAt: article.created_at,
        receivedAt,
        url: article.url,
        verified: true,
        provider: "alpaca",
        raw: article,
      }),
    );
  }
}

export function createAlpacaNewsProviderFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): AlpacaNewsProvider {
  return new AlpacaNewsProvider({
    apiKeyId: (env.ALPACA_API_KEY_ID ?? "").trim(),
    apiSecretKey: (env.ALPACA_API_SECRET_KEY ?? "").trim(),
    baseUrl: env.ALPACA_NEWS_BASE_URL ?? env.ALPACA_DATA_BASE_URL,
  });
}
