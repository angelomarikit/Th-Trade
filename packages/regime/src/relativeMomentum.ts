import type { Bar, MarketSnapshot } from "@wulu/market-data";
import { sessionVwap } from "@wulu/market-data";
import {
  classifyTrend,
  completedBars,
  priceVsVwap,
  relativeStrengthRatio,
  trendSlopePct,
} from "./technicals.js";

export interface RelativeMomentumSnapshot {
  feed: string;
  feedLimitation: string;
  symbolIntradayPct: number | null;
  spyIntradayPct: number | null;
  qqqIntradayPct: number | null;
  sectorEtf: string;
  sectorIntradayPct: number | null;
  /** Symbol return − SPY return (percentage points). Green-with-market ≠ strong. */
  vsSpyPct: number | null;
  vsQqqPct: number | null;
  vsSectorPct: number | null;
  gapPct: number | null;
  rvol: number | null;
  vwapLocation: "ABOVE" | "BELOW" | "AT" | "UNKNOWN";
  intradayTrend: "BULLISH" | "BEARISH" | "RANGE";
  /** Higher = stronger legitimate relative momentum (for ranking only). */
  rankScore: number;
  notes: string[];
}

export interface RankedCandidate extends RelativeMomentumSnapshot {
  symbol: string;
  rank: number;
}

const FEED_LIMITATION =
  "Comparisons use available bar data (often IEX). Not NBBO; rankings are relative context, not trade permission.";

/**
 * Build relative strength / momentum from actual bars.
 * Does not invent values — nulls when insufficient completed data.
 */
export function buildRelativeMomentum(input: {
  symbolSnapshot: MarketSnapshot;
  spy: MarketSnapshot;
  qqq: MarketSnapshot | null;
  sectorEtf: string;
  sector: MarketSnapshot | null;
  feed?: string;
}): RelativeMomentumSnapshot {
  const feed = input.feed ?? "iex";
  const notes: string[] = [];
  const symBars = preferBars(input.symbolSnapshot);
  const spyBars = preferBars(input.spy);
  const qqqBars = input.qqq ? preferBars(input.qqq) : [];
  const sectorBars = input.sector ? preferBars(input.sector) : [];

  const symbolIntradayPct = sessionReturnPct(symBars);
  const spyIntradayPct = sessionReturnPct(spyBars);
  const qqqIntradayPct = qqqBars.length ? sessionReturnPct(qqqBars) : null;
  const sectorIntradayPct = sectorBars.length ? sessionReturnPct(sectorBars) : null;

  const vsSpyPct = relativeStrengthRatio(symBars, spyBars, Math.min(10, completedBars(symBars).length));
  const vsQqqPct =
    qqqBars.length >= 10
      ? relativeStrengthRatio(symBars, qqqBars, 10)
      : null;
  const vsSectorPct =
    sectorBars.length >= 10
      ? relativeStrengthRatio(symBars, sectorBars, 10)
      : null;

  const gapPct = gapFromBars(symBars);
  const rvol = rollingRelativeVolume(symBars);
  const vwapLocation = priceVsVwap(symBars, input.symbolSnapshot.lastPrice);
  const slope = trendSlopePct(symBars, 10);
  const intradayTrend = classifyTrend(slope);

  if (vsSpyPct != null && Math.abs(vsSpyPct) < 0.15 && (symbolIntradayPct ?? 0) > 0) {
    notes.push("Symbol is green with the market — not automatically relatively strong vs SPY");
  }
  if (vsSpyPct != null && vsSpyPct < -0.35 && (spyIntradayPct ?? 0) > 0) {
    notes.push("Symbol lagging while SPY is up — relative weakness");
  }
  if (vsSpyPct != null && vsSpyPct > 0.35 && (spyIntradayPct ?? 0) < 0) {
    notes.push("Symbol outperforming while SPY is down — meaningful relative strength");
  }
  if (rvol != null && rvol < 1) {
    notes.push(`RVOL ${rvol.toFixed(2)}x below average — momentum less trustworthy`);
  }
  if (vsSpyPct == null) {
    notes.push("Insufficient completed bars for SPY relative strength");
  }

  const rankScore = computeRankScore({
    vsSpyPct,
    vsQqqPct,
    vsSectorPct,
    rvol,
    vwapLocation,
    intradayTrend,
    gapPct,
  });

  return {
    feed,
    feedLimitation: FEED_LIMITATION,
    symbolIntradayPct,
    spyIntradayPct,
    qqqIntradayPct,
    sectorEtf: input.sectorEtf,
    sectorIntradayPct,
    vsSpyPct,
    vsQqqPct,
    vsSectorPct,
    gapPct,
    rvol,
    vwapLocation,
    intradayTrend,
    rankScore,
    notes,
  };
}

/** Rank candidates by computed rankScore (descending). */
export function rankByRelativeMomentum(
  rows: Array<{ symbol: string; momentum: RelativeMomentumSnapshot }>,
): RankedCandidate[] {
  const sorted = [...rows].sort((a, b) => b.momentum.rankScore - a.momentum.rankScore);
  return sorted.map((r, i) => ({
    symbol: r.symbol,
    rank: i + 1,
    ...r.momentum,
  }));
}

function preferBars(snapshot: MarketSnapshot): Bar[] {
  return snapshot.bars5m.length >= 20 ? snapshot.bars5m : snapshot.bars1m;
}

function sessionReturnPct(bars: Bar[]): number | null {
  const c = completedBars(bars);
  if (c.length < 2) return null;
  const first = c[0]!.open;
  const last = c[c.length - 1]!.close;
  if (first <= 0) return null;
  return ((last - first) / first) * 100;
}

function gapFromBars(bars: Bar[]): number | null {
  const c = completedBars(bars);
  if (c.length < 2) return null;
  // Approximate gap: first open vs prior close when timestamps cross sessions is hard offline;
  // use first bar open vs first bar prior close when available via open/close of bar[0]/bar[1].
  const first = c[0]!;
  const second = c[1]!;
  if (first.close <= 0) return null;
  return ((second.open - first.close) / first.close) * 100;
}

function rollingRelativeVolume(bars: Bar[]): number | null {
  const c = completedBars(bars);
  if (c.length < 6) return null;
  const recent = c.slice(-5);
  const recentAvg = recent.reduce((a, b) => a + b.volume, 0) / recent.length;
  const base = c.reduce((a, b) => a + b.volume, 0) / c.length;
  if (base <= 0) return null;
  return recentAvg / base;
}

function computeRankScore(input: {
  vsSpyPct: number | null;
  vsQqqPct: number | null;
  vsSectorPct: number | null;
  rvol: number | null;
  vwapLocation: "ABOVE" | "BELOW" | "AT" | "UNKNOWN";
  intradayTrend: "BULLISH" | "BEARISH" | "RANGE";
  gapPct: number | null;
}): number {
  let score = 50;
  if (input.vsSpyPct != null) score += clamp(input.vsSpyPct * 8, -20, 20);
  if (input.vsQqqPct != null) score += clamp(input.vsQqqPct * 4, -10, 10);
  if (input.vsSectorPct != null) score += clamp(input.vsSectorPct * 4, -10, 10);
  if (input.rvol != null) {
    if (input.rvol >= 1.5) score += 8;
    else if (input.rvol < 0.8) score -= 6;
  }
  if (input.vwapLocation === "ABOVE") score += 4;
  if (input.vwapLocation === "BELOW") score -= 4;
  if (input.intradayTrend === "BULLISH") score += 5;
  if (input.intradayTrend === "BEARISH") score -= 5;
  if (input.gapPct != null) score += clamp(input.gapPct * 2, -6, 6);
  return Math.round(clamp(score, 0, 100));
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/** Exported for tests — session VWAP presence check. */
export function hasSessionVwap(bars: Bar[]): boolean {
  return sessionVwap(completedBars(bars).length ? completedBars(bars) : bars) != null;
}
