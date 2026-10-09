import { createHash } from "node:crypto";
import { clusterNewsItems } from "./dedupe/cluster.js";
import { scoreCatalystImportance } from "./scoring/importance.js";
import { scoreSourceReliability } from "./scoring/reliability.js";
import { scoreNewsFreshness } from "./scoring/freshness.js";
import { scoreDirectionalSentiment } from "./scoring/sentiment.js";
import { scoreMarketReactionConfirmation } from "./scoring/marketReaction.js";
import { buildWhyMoving } from "./whyMoving.js";
import type {
  CatalystEvent,
  MarketReactionContext,
  NewsItem,
} from "./types.js";

export function buildCatalystEvents(
  items: NewsItem[],
  options?: {
    now?: Date;
    marketReactionByTicker?: Record<string, MarketReactionContext>;
  },
): CatalystEvent[] {
  const now = options?.now ?? new Date();
  const clusters = clusterNewsItems(items);

  return clusters.map((members) => {
    const sortedByTime = [...members].sort(
      (a, b) => a.publishedAt.getTime() - b.publishedAt.getTime(),
    );
    const byCredibility = [...members].sort(
      (a, b) =>
        b.sourceReliabilityPrior - a.sourceReliabilityPrior ||
        a.publishedAt.getTime() - b.publishedAt.getTime(),
    );
    const original = byCredibility[0]!;
    const earliest = sortedByTime[0]!;

    const tickers = unique([
      ...members.flatMap((m) => m.tickers),
    ]);

    const sentiment = scoreDirectionalSentiment(members);
    const primaryTicker = tickers[0];
    const reactionCtx =
      primaryTicker && options?.marketReactionByTicker
        ? options.marketReactionByTicker[primaryTicker]
        : undefined;
    const { confirmation, label } = scoreMarketReactionConfirmation(
      sentiment.score,
      reactionCtx,
    );

    const scores = {
      catalystImportance: scoreCatalystImportance(members),
      sourceReliability: scoreSourceReliability(members),
      newsFreshness: scoreNewsFreshness(members, now),
      directionalSentiment: sentiment,
      marketReactionConfirmation: confirmation,
    };

    const event: CatalystEvent = {
      eventId: eventIdFor(earliest, tickers),
      tickers,
      category: original.category,
      eventType: original.eventType,
      originalSource: original.source,
      originalPublishedAt: earliest.publishedAt,
      earliestReceivedAt: members.reduce(
        (min, m) => (m.receivedAt < min ? m.receivedAt : min),
        members[0]!.receivedAt,
      ),
      headline: earliest.headline,
      summary: earliest.summary,
      url: earliest.url ?? original.url,
      company: earliest.company ?? original.company,
      sector: earliest.sector ?? original.sector,
      verified: members.some((m) => m.verified),
      memberCount: members.length,
      members,
      scores,
      priceReaction: label,
      whyMoving: "",
    };

    event.whyMoving = buildWhyMoving(event).whyMoving;
    return event;
  });
}

export function selectPrimaryCatalystForTicker(
  events: CatalystEvent[],
  ticker: string,
): CatalystEvent | null {
  const t = ticker.toUpperCase();
  const matched = events.filter((e) => e.tickers.includes(t));
  if (matched.length === 0) return null;

  return matched.sort(
    (a, b) =>
      b.scores.catalystImportance.score - a.scores.catalystImportance.score ||
      b.scores.newsFreshness.score - a.scores.newsFreshness.score ||
      a.originalPublishedAt.getTime() - b.originalPublishedAt.getTime(),
  )[0]!;
}

function eventIdFor(earliest: NewsItem, tickers: string[]): string {
  const base = [
    tickers.join(","),
    earliest.publishedAt.toISOString().slice(0, 13),
    earliest.headline.slice(0, 80).toLowerCase(),
  ].join("|");
  return createHash("sha256").update(base).digest("hex").slice(0, 16);
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((v) => v.toUpperCase()))].sort();
}
