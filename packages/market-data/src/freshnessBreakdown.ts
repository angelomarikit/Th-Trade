import { isQuoteUsableForEntry } from "./quoteUsability.js";
import { barEffectiveEndTime } from "./freshness.js";
import { classifyUsEquitySession, type SessionSnapshot } from "./session.js";
import type { MarketSnapshot } from "./types.js";

export interface MarketDataFreshnessBreakdown {
  session: string;
  /** Alpaca/API reachable for this scan (snapshot exists). */
  snapshotOk: boolean;
  barsFresh: boolean;
  barsAgeSec: number | null;
  quotePresent: boolean;
  quoteFresh: boolean;
  quoteAgeSec: number | null;
  quoteUsableForEntry: boolean;
  /** Same as card.dataFresh — all gates for verified setup evaluation. */
  verifiedForSetup: boolean;
  summary: string;
}

export function buildMarketDataFreshnessBreakdown(
  snapshot: MarketSnapshot,
  verifiedForSetup: boolean,
  verifyReason: string,
  now: Date = new Date(),
  session?: SessionSnapshot,
): MarketDataFreshnessBreakdown {
  const sess = session ?? classifyUsEquitySession(now);
  const limit = sess.maxDataAgeMs;
  const last1m = snapshot.bars1m.at(-1);
  const barEnd = last1m ? barEffectiveEndTime(last1m) : null;
  const barsAgeMs = barEnd ? Math.max(0, now.getTime() - barEnd.getTime()) : null;
  const barsFresh = barsAgeMs != null && limit > 0 ? barsAgeMs <= limit : false;

  const quote = snapshot.quote;
  const quoteAgeMs = quote ? Math.max(0, now.getTime() - quote.timestamp.getTime()) : null;
  const fetchAgeMs = Math.max(0, now.getTime() - snapshot.receivedAt.getTime());
  const quoteFresh =
    quoteAgeMs != null && limit > 0
      ? quoteAgeMs <= limit ||
          (fetchAgeMs < 5_000 &&
            barsFresh &&
            isQuoteUsableForEntry(snapshot) &&
            quoteAgeMs <= limit + 30_000)
      : false;
  const quoteUsable = isQuoteUsableForEntry(snapshot);

  let summary = verifyReason;
  if (!verifiedForSetup && barsFresh && quotePresent(quote) && !quoteFresh) {
    summary = `Chart bars are current (~${((barsAgeMs ?? 0) / 1000).toFixed(0)}s). NBBO quote timestamp is older — ENTER stays blocked until the quote is fresh and usable.`;
  } else if (!verifiedForSetup && barsFresh && !quoteUsable) {
    summary = `Bars updating; bid/ask spread or missing quote blocks verified entry (IEX). ${verifyReason}`;
  }

  return {
    session: sess.session,
    snapshotOk: true,
    barsFresh,
    barsAgeSec: barsAgeMs != null ? barsAgeMs / 1000 : null,
    quotePresent: quotePresent(quote),
    quoteFresh,
    quoteAgeSec: quoteAgeMs != null ? quoteAgeMs / 1000 : null,
    quoteUsableForEntry: quoteUsable,
    verifiedForSetup,
    summary,
  };
}

function quotePresent(quote: MarketSnapshot["quote"]): boolean {
  return quote != null && quote.bid > 0 && quote.ask > 0;
}
