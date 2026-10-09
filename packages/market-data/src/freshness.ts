import { classifyUsEquitySession, type SessionSnapshot } from "./session.js";
import type { FreshnessResult, MarketSnapshot } from "./types.js";

/** Fallback when session profile not supplied. */
export const DEFAULT_MAX_DATA_AGE_MS = 90_000;

export function assessFreshness(
  snapshot: MarketSnapshot,
  now: Date = new Date(),
  maxAgeMs: number = DEFAULT_MAX_DATA_AGE_MS,
  session?: SessionSnapshot,
): FreshnessResult {
  const sess = session ?? classifyUsEquitySession(now);
  const limit =
    sess.maxDataAgeMs === 0 ? 0 : maxAgeMs !== DEFAULT_MAX_DATA_AGE_MS ? maxAgeMs : sess.maxDataAgeMs;

  const marketTs = snapshot.marketTimestamp ?? snapshot.quote?.timestamp ?? null;
  if (!marketTs) {
    return {
      ok: false,
      ageMs: Number.POSITIVE_INFINITY,
      maxAgeMs: limit,
      reason: `No market timestamp — DATA NOT VERIFIED (${sess.session})`,
    };
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

