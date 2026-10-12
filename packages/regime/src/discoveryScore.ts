import type { DiscoverySnapshot } from "@wulu/market-data";
import { sectorEtfFor } from "./sectorMap.js";

export type DiscoverySide = "LONG" | "SHORT";

export interface DiscoveryFeatures {
  symbol: string;
  sectorEtf: string;
  lastPrice: number;
  dayChangePct: number | null;
  gapPct: number | null;
  /** dayVolume / prevDayVolume — IEX approximate */
  rvolProxy: number | null;
  vsSpyPct: number | null;
  vsSectorPct: number | null;
  spreadPct: number | null;
  notes: string[];
}

export interface ScoredOpportunity {
  symbol: string;
  side: DiscoverySide;
  rankScore: number;
  features: DiscoveryFeatures;
  catalystBoost: number;
  catalystHeadline: string | null;
  disclaimer: string;
}

const DISCLAIMER =
  "Discovery rank is context only — not ENTRY permission. Must pass confirmation (min 2R, structure, volume, VWAP). IEX volume ≠ consolidated. Auto-trading disabled.";

/**
 * Score a universe of discovery snapshots into LONG and SHORT ranked lists.
 * Does not invent prices — null features reduce score rather than fabricate edge.
 */
export function scoreDiscoveryUniverse(input: {
  snaps: DiscoverySnapshot[];
  catalystBySymbol?: Record<string, { boost: number; headline: string | null }>;
  feed?: string;
}): { long: ScoredOpportunity[]; short: ScoredOpportunity[]; features: DiscoveryFeatures[] } {
  const bySym = new Map(input.snaps.map((s) => [s.symbol.toUpperCase(), s]));
  const spy = bySym.get("SPY") ?? null;
  const features: DiscoveryFeatures[] = [];

  for (const snap of input.snaps) {
    if (isEtfOnlyContext(snap.symbol)) continue;
    features.push(buildFeatures(snap, spy, bySym));
  }

  const long: ScoredOpportunity[] = [];
  const short: ScoredOpportunity[] = [];

  for (const f of features) {
    const cat = input.catalystBySymbol?.[f.symbol] ?? { boost: 0, headline: null };
    const longScore = scoreSide("LONG", f) + cat.boost;
    const shortScore = scoreSide("SHORT", f) + (cat.boost > 0 ? Math.min(cat.boost, 4) : 0);

    long.push({
      symbol: f.symbol,
      side: "LONG",
      rankScore: Math.round(clamp(longScore, 0, 100)),
      features: f,
      catalystBoost: cat.boost,
      catalystHeadline: cat.headline,
      disclaimer: DISCLAIMER,
    });
    short.push({
      symbol: f.symbol,
      side: "SHORT",
      rankScore: Math.round(clamp(shortScore, 0, 100)),
      features: f,
      catalystBoost: cat.boost,
      catalystHeadline: cat.headline,
      disclaimer: DISCLAIMER,
    });
  }

  long.sort((a, b) => b.rankScore - a.rankScore);
  short.sort((a, b) => b.rankScore - a.rankScore);
  return { long, short, features };
}

function buildFeatures(
  snap: DiscoverySnapshot,
  spy: DiscoverySnapshot | null,
  bySym: Map<string, DiscoverySnapshot>,
): DiscoveryFeatures {
  const notes: string[] = [];
  const sectorEtf = sectorEtfFor(snap.symbol);
  const sector = bySym.get(sectorEtf) ?? null;

  const dayChangePct =
    snap.prevClose != null && snap.prevClose > 0
      ? ((snap.lastPrice - snap.prevClose) / snap.prevClose) * 100
      : null;
  const gapPct =
    snap.prevClose != null && snap.dayOpen != null && snap.prevClose > 0
      ? ((snap.dayOpen - snap.prevClose) / snap.prevClose) * 100
      : null;
  const rvolProxy =
    snap.dayVolume != null &&
    snap.prevDayVolume != null &&
    snap.prevDayVolume > 0
      ? snap.dayVolume / snap.prevDayVolume
      : null;

  const spyChange =
    spy?.prevClose != null && spy.prevClose > 0
      ? ((spy.lastPrice - spy.prevClose) / spy.prevClose) * 100
      : null;
  const sectorChange =
    sector?.prevClose != null && sector.prevClose > 0
      ? ((sector.lastPrice - sector.prevClose) / sector.prevClose) * 100
      : null;

  const vsSpyPct =
    dayChangePct != null && spyChange != null ? dayChangePct - spyChange : null;
  const vsSectorPct =
    dayChangePct != null && sectorChange != null ? dayChangePct - sectorChange : null;

  let spreadPct: number | null = null;
  if (snap.bid != null && snap.ask != null && snap.bid > 0 && snap.ask >= snap.bid) {
    const mid = (snap.bid + snap.ask) / 2;
    spreadPct = mid > 0 ? ((snap.ask - snap.bid) / mid) * 100 : null;
  }

  if (rvolProxy != null && rvolProxy >= 1.5) {
    notes.push(`Unusual volume proxy ${rvolProxy.toFixed(2)}x vs prior day (IEX approx)`);
  }
  if (vsSpyPct != null && Math.abs(vsSpyPct) < 0.2 && (dayChangePct ?? 0) > 0) {
    notes.push("Green with the market — not automatically relatively strong");
  }
  if (dayChangePct == null) notes.push("Missing prior close — day change unknown");

  return {
    symbol: snap.symbol,
    sectorEtf,
    lastPrice: snap.lastPrice,
    dayChangePct,
    gapPct,
    rvolProxy,
    vsSpyPct,
    vsSectorPct,
    spreadPct,
    notes,
  };
}

function scoreSide(side: DiscoverySide, f: DiscoveryFeatures): number {
  let score = 45;
  const dir = side === "LONG" ? 1 : -1;

  if (f.vsSpyPct != null) score += clamp(f.vsSpyPct * dir * 10, -22, 22);
  if (f.vsSectorPct != null) score += clamp(f.vsSectorPct * dir * 6, -12, 12);
  if (f.dayChangePct != null) score += clamp(f.dayChangePct * dir * 3, -10, 10);
  if (f.gapPct != null) score += clamp(f.gapPct * dir * 2, -8, 8);

  if (f.rvolProxy != null) {
    if (f.rvolProxy >= 2) score += 12;
    else if (f.rvolProxy >= 1.5) score += 8;
    else if (f.rvolProxy < 0.7) score -= 8;
  } else {
    score -= 4;
  }

  if (f.spreadPct != null) {
    if (f.spreadPct > 0.5) score -= 10;
    else if (f.spreadPct > 0.25) score -= 4;
  }

  return score;
}

function isEtfOnlyContext(symbol: string): boolean {
  // Keep SPY/QQQ/sector ETFs out of ranked single-name opportunity lists
  return (
    symbol === "SPY" ||
    symbol === "QQQ" ||
    symbol === "IWM" ||
    symbol === "DIA" ||
    symbol.startsWith("XL") ||
    symbol === "SMH" ||
    symbol === "XBI" ||
    symbol === "ARKK"
  );
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}
