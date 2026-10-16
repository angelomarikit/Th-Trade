import { classifyUsEquitySession, type SessionSnapshot } from "./session.js";
import type { Bar, FreshnessResult, MarketSnapshot } from "./types.js";

/** Fallback when session profile not supplied. */
export const DEFAULT_MAX_DATA_AGE_MS = 90_000;

const BAR_DURATION_MS: Record<Bar["timeframe"], number> = {
  "1Min": 60_000,
  "5Min": 300_000,
  "15Min": 900_000,
  "1Day": 86_400_000,
};

/** Bar timestamps from Alpaca are bar **open**; freshness uses effective end-of-bar time. */
export function barEffectiveEndTime(bar: Bar): Date {
  const dur = BAR_DURATION_MS[bar.timeframe] ?? 60_000;
  return new Date(bar.timestamp.getTime() + dur);
}

/**
 * Best estimate of "how current is this snapshot" for freshness checks.
 * Prefers latest quote/trade, then latest 1m bar end, then 5m bar end.
 */
export function resolveMarketDataTimestamp(snapshot: MarketSnapshot): Date | null {
  const candidates: number[] = [];
  if (snapshot.quote?.timestamp) candidates.push(snapshot.quote.timestamp.getTime());
  const last1m = snapshot.bars1m.at(-1);
  const last5m = snapshot.bars5m.at(-1);
  if (last1m) candidates.push(barEffectiveEndTime(last1m).getTime());
  if (last5m) candidates.push(barEffectiveEndTime(last5m).getTime());
  if (snapshot.marketTimestamp) candidates.push(snapshot.marketTimestamp.getTime());
  if (candidates.length === 0) return null;
  return new Date(Math.max(...candidates));
}

export function assessFreshness(
  snapshot: MarketSnapshot,
  now: Date = new Date(),
  maxAgeMs: number = DEFAULT_MAX_DATA_AGE_MS,
  session?: SessionSnapshot,
): FreshnessResult {
  const sess = session ?? classifyUsEquitySession(now);
  const limit =
    sess.maxDataAgeMs === 0 ? 0 : maxAgeMs !== DEFAULT_MAX_DATA_AGE_MS ? maxAgeMs : sess.maxDataAgeMs;

  const marketTs = resolveMarketDataTimestamp(snapshot);
  if (!marketTs) {
    return {
      ok: false,
      ageMs: Number.POSITIVE_INFINITY,
      maxAgeMs: limit,
      reason: `No market timestamp — DATA NOT VERIFIED (${sess.session})`,
    };
  }

  // When a quote is present during RTH, it must be fresh — do not let stale quotes hide behind newer bar timestamps.
  if (snapshot.quote?.timestamp && sess.session === "RTH" && limit > 0) {
    const quoteAgeMs = Math.max(0, now.getTime() - snapshot.quote.timestamp.getTime());
    if (quoteAgeMs > limit) {
      return {
        ok: false,
        ageMs: quoteAgeMs,
        maxAgeMs: limit,
        reason: `Stale quote age ${(quoteAgeMs / 1000).toFixed(1)}s > ${(limit / 1000).toFixed(0)}s (${sess.session}) — fail closed`,
      };
    }
  }

  const ageMs = Math.max(0, now.getTime() - marketTs.getTime());

  if (limit === 0) {
    return {
      ok: false,
      ageMs,
      maxAgeMs: 0,
      reason: `${sess.reason} — DATA NOT VERIFIED`,
    };
  }

  if (ageMs > limit) {
    return {
      ok: false,
      ageMs,
      maxAgeMs: limit,
      reason: `Stale data age ${(ageMs / 1000).toFixed(1)}s > ${(limit / 1000).toFixed(0)}s (${sess.session}) — fail closed`,
    };
  }

  return {
    ok: true,
    ageMs,
    maxAgeMs: limit,
    reason: `Data age ${(ageMs / 1000).toFixed(1)}s within ${sess.session} limit`,
  };
}
