import type { BacktestTrade } from "./types.js";

export interface EdgeMetrics {
  sampleSize: number;
  wins: number;
  losses: number;
  winRate: number | null;
  averageWinnerR: number | null;
  averageLoserR: number | null;
  expectancyR: number | null;
  profitFactor: number | null;
  maxDrawdownR: number | null;
  averageR: number | null;
  medianR: number | null;
  largestWinnerR: number | null;
  largestLoserR: number | null;
  maxConsecutiveLosses: number;
  byRegime: Record<string, { sampleSize: number; winRate: number | null; expectancyR: number | null }>;
  byHourUtc: Record<string, { sampleSize: number; winRate: number | null; expectancyR: number | null }>;
  withCatalyst: { sampleSize: number; winRate: number | null; expectancyR: number | null };
  withoutCatalyst: { sampleSize: number; winRate: number | null; expectancyR: number | null };
}

export function computeEdgeMetrics(trades: BacktestTrade[]): EdgeMetrics {
  const sampleSize = trades.length;
  const winners = trades.filter((t) => t.rMultiple > 0);
  const losers = trades.filter((t) => t.rMultiple <= 0);
  const rs = trades.map((t) => t.rMultiple);

  const winRate = sampleSize ? winners.length / sampleSize : null;
  const averageWinnerR = avg(winners.map((t) => t.rMultiple));
  const averageLoserR = avg(losers.map((t) => t.rMultiple));
  const expectancyR = avg(rs);
  const averageR = expectancyR;
  const medianR = median(rs);
  const largestWinnerR = rs.length ? Math.max(...rs) : null;
  const largestLoserR = rs.length ? Math.min(...rs) : null;

  const grossWin = winners.reduce((a, t) => a + t.rMultiple, 0);
  const grossLoss = Math.abs(losers.reduce((a, t) => a + t.rMultiple, 0));
  const profitFactor = grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? null : null;

  return {
    sampleSize,
    wins: winners.length,
    losses: losers.length,
    winRate,
    averageWinnerR,
    averageLoserR,
    expectancyR,
    profitFactor,
    maxDrawdownR: maxDrawdown(rs),
    averageR,
    medianR,
    largestWinnerR,
    largestLoserR,
    maxConsecutiveLosses: maxConsecutiveLosses(trades),
    byRegime: groupStats(trades, (t) => t.regimePrimary ?? "UNKNOWN"),
    byHourUtc: groupStats(trades, (t) => String(t.entryHourUtc)),
    withCatalyst: subsetStats(trades.filter((t) => t.hasCatalyst === true)),
    withoutCatalyst: subsetStats(trades.filter((t) => t.hasCatalyst !== true)),
  };
}

function groupStats(
  trades: BacktestTrade[],
  keyFn: (t: BacktestTrade) => string,
): Record<string, { sampleSize: number; winRate: number | null; expectancyR: number | null }> {
  const map = new Map<string, BacktestTrade[]>();
  for (const t of trades) {
    const k = keyFn(t);
    const arr = map.get(k) ?? [];
    arr.push(t);
    map.set(k, arr);
  }
  const out: Record<string, { sampleSize: number; winRate: number | null; expectancyR: number | null }> = {};
  for (const [k, arr] of map) {
    out[k] = subsetStats(arr);
  }
  return out;
}

function subsetStats(trades: BacktestTrade[]) {
  const sampleSize = trades.length;
  if (!sampleSize) return { sampleSize: 0, winRate: null, expectancyR: null };
  const wins = trades.filter((t) => t.rMultiple > 0).length;
  return {
    sampleSize,
    winRate: wins / sampleSize,
    expectancyR: avg(trades.map((t) => t.rMultiple)),
  };
}

function avg(xs: number[]): number | null {
  if (!xs.length) return null;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function median(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

function maxDrawdown(rs: number[]): number | null {
  if (!rs.length) return null;
  let equity = 0;
  let peak = 0;
  let maxDd = 0;
  for (const r of rs) {
    equity += r;
    peak = Math.max(peak, equity);
    maxDd = Math.min(maxDd, equity - peak);
  }
  return maxDd;
}

function maxConsecutiveLosses(trades: BacktestTrade[]): number {
  let max = 0;
  let cur = 0;
  for (const t of trades) {
    if (t.rMultiple <= 0) {
      cur += 1;
      max = Math.max(max, cur);
    } else {
      cur = 0;
    }
  }
  return max;
}
