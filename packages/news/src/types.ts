import type { CatalystCategory, EventType } from "./categories.js";

export interface NewsItem {
  id: string;
  headline: string;
  summary?: string;
  tickers: string[];
  source: string;
  publishedAt: Date;
  receivedAt: Date;
  url?: string;
  category: CatalystCategory;
  eventType: EventType;
  verified: boolean;
  /** Provider-reported or mapped reliability prior, 0–100 */
  sourceReliabilityPrior: number;
  company?: string;
  sector?: string;
  provider: string;
  raw?: unknown;
}

export interface ScoreWithReasons {
  score: number;
  reasons: string[];
}

export interface CatalystScores {
  catalystImportance: ScoreWithReasons;
  sourceReliability: ScoreWithReasons;
  newsFreshness: ScoreWithReasons;
  /** -100 to +100 — directional lean only, NOT win probability */
  directionalSentiment: ScoreWithReasons;
  marketReactionConfirmation: ScoreWithReasons;
}

export type PriceReactionLabel =
  | "CONFIRMING"
  | "CONFLICTING"
  | "NEUTRAL"
  | "INSUFFICIENT_DATA";

export interface MarketReactionContext {
  priceVsVwap: "ABOVE" | "BELOW" | "AT" | "UNKNOWN";
  relativeVolume: "HIGH" | "NORMAL" | "LOW" | "UNKNOWN";
  relativeStrength: "STRONG" | "WEAK" | "INLINE" | "UNKNOWN";
  /** Optional short description of observed price action */
  notes?: string[];
}

export interface CatalystEvent {
  eventId: string;
  tickers: string[];
  category: CatalystCategory;
  eventType: EventType;
  /** Earliest credible item in the cluster */
  originalSource: string;
  originalPublishedAt: Date;
  earliestReceivedAt: Date;
  headline: string;
  summary?: string;
  url?: string;
  company?: string;
  sector?: string;
  verified: boolean;
  memberCount: number;
  members: NewsItem[];
  scores: CatalystScores;
  priceReaction: PriceReactionLabel;
  /** Human-safe explanation; never invents a catalyst */
  whyMoving: string;
}

export interface WhyMovingBlock {
  whyMoving: string;
  catalystLabel: string | null;
  newsAgeMinutes: number | null;
  priceReaction: PriceReactionLabel | null;
  hasVerifiedCatalyst: boolean;
}

export interface NewsQuery {
  tickers?: string[];
  since?: Date;
  until?: Date;
  limit?: number;
}

export const NO_VERIFIED_CATALYST_MESSAGE = "NO VERIFIED NEWS CATALYST FOUND";
