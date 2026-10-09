import {
  buildCatalystEvents,
  selectPrimaryCatalystForTicker,
} from "./buildCatalystEvent.js";
import type { NewsProvider } from "./NewsProvider.js";
import { buildWhyMoving } from "./whyMoving.js";
import {
  NO_VERIFIED_CATALYST_MESSAGE,
  type CatalystEvent,
  type MarketReactionContext,
  type NewsQuery,
  type WhyMovingBlock,
} from "./types.js";

export interface NewsServiceOptions {
  provider: NewsProvider;
  /** Max age of news considered for live catalyst attachment (default 24h) */
  maxAgeHours?: number;
}

/**
 * Orchestrates fetch → normalize (in provider) → cluster → score → WHY MOVING.
 * Does not modify setup state / ENTRY ACTIVE.
 */
export class NewsService {
  private readonly maxAgeHours: number;

  constructor(private readonly options: NewsServiceOptions) {
    this.maxAgeHours = options.maxAgeHours ?? 24;
  }

  get providerName(): string {
    return this.options.provider.name;
  }

  async fetchRaw(query: NewsQuery = {}) {
    return this.options.provider.fetchNews(query);
  }

  async getCatalystEvents(
    query: NewsQuery = {},
    marketReactionByTicker?: Record<string, MarketReactionContext>,
  ): Promise<CatalystEvent[]> {
    const since =
      query.since ?? new Date(Date.now() - this.maxAgeHours * 60 * 60 * 1000);
    const items = await this.options.provider.fetchNews({ ...query, since });
    return buildCatalystEvents(items, { marketReactionByTicker });
  }

  async getCatalystForTicker(
    ticker: string,
    marketReaction?: MarketReactionContext,
  ): Promise<{
    event: CatalystEvent | null;
    why: WhyMovingBlock;
  }> {
    const reactionMap = marketReaction
      ? { [ticker.toUpperCase()]: marketReaction }
      : undefined;
    const events = await this.getCatalystEvents({ tickers: [ticker] }, reactionMap);
    const event = selectPrimaryCatalystForTicker(events, ticker);
    return { event, why: buildWhyMoving(event) };
  }
}

export function emptyWhyMoving(): WhyMovingBlock {
  return {
    whyMoving: NO_VERIFIED_CATALYST_MESSAGE,
    catalystLabel: null,
    newsAgeMinutes: null,
    priceReaction: null,
    hasVerifiedCatalyst: false,
  };
}
