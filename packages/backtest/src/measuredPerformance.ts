/**
 * Aggregate durable signal_performance rows into measured stats.
 * Never invents win rates — insufficient samples return null rates + clear notes.
 */

export type MeasuredSource = "LIVE" | "HISTORICAL_REPLAY" | "ALL";

export interface MeasuredPerformanceInputRow {
  symbol?: string;
  side?: string;
  strategyType?: string;
  source?: string;
  outcomeStatus?: string;
  outcomeR?: number | null;
  actionable?: boolean;
  liveValidated?: boolean;
  state?: string;
}

export interface MeasuredBucket {
  key: string;
  sampleSize: number;
  resolved: number;
  wins: number;
  losses: number;
  ambiguous: number;
  winRatePct: number | null;
  avgOutcomeR: number | null;
  liveValidatedCount: number;
  actionableCount: number;
  note: string;
}

export interface MeasuredPerformanceReport {
  minSampleForRate: number;
  sourceFilter: MeasuredSource;
  overall: MeasuredBucket;
  bySymbol: MeasuredBucket[];
  bySide: MeasuredBucket[];
  byStrategy: MeasuredBucket[];
  disclaimer: string;
  automaticOrders: false;
}

const DEFAULT_MIN_SAMPLE = 20;

const DISCLAIMER =
  "Measured performance from stored scanner records. HISTORICAL_REPLAY is hypothetical. LIVE outcomes are not a published edge until liveValidated. Auto-trading disabled. Past results ≠ future performance.";

export function aggregateMeasuredPerformance(
  rows: MeasuredPerformanceInputRow[],
  opts?: { source?: MeasuredSource; minSampleForRate?: number },
): MeasuredPerformanceReport {
  const sourceFilter = opts?.source ?? "ALL";
  const minSample = opts?.minSampleForRate ?? DEFAULT_MIN_SAMPLE;

  const filtered = rows.filter((r) => {
    if (sourceFilter === "ALL") return true;
    return (r.source ?? "LIVE") === sourceFilter;
  });

  const overall = bucket("ALL", filtered, minSample);
  const bySymbol = groupBuckets(filtered, (r) => (r.symbol ?? "UNKNOWN").toUpperCase(), minSample)
    .sort((a, b) => b.resolved - a.resolved)
    .slice(0, 40);
  const bySide = groupBuckets(filtered, (r) => (r.side ?? "LONG").toUpperCase(), minSample);
  const byStrategy = groupBuckets(
    filtered,
    (r) => r.strategyType ?? "SCANNER",
    minSample,
  ).sort((a, b) => b.resolved - a.resolved);

  return {
    minSampleForRate: minSample,
    sourceFilter,
    overall,
    bySymbol,
    bySide,
    byStrategy,
    disclaimer: DISCLAIMER,
    automaticOrders: false,
  };
}

function groupBuckets(
  rows: MeasuredPerformanceInputRow[],
  keyFn: (r: MeasuredPerformanceInputRow) => string,
  minSample: number,
): MeasuredBucket[] {
  const map = new Map<string, MeasuredPerformanceInputRow[]>();
  for (const r of rows) {
    const k = keyFn(r);
    const list = map.get(k) ?? [];
    list.push(r);
    map.set(k, list);
  }
  return [...map.entries()].map(([k, list]) => bucket(k, list, minSample));
}

function bucket(
  key: string,
  rows: MeasuredPerformanceInputRow[],
  minSample: number,
): MeasuredBucket {
  const resolvedRows = rows.filter((r) =>
    ["WIN", "LOSS", "BREAKEVEN", "AMBIGUOUS"].includes(String(r.outcomeStatus ?? "")),
  );
  const wins = resolvedRows.filter((r) => r.outcomeStatus === "WIN").length;
  const losses = resolvedRows.filter((r) => r.outcomeStatus === "LOSS").length;
  const ambiguous = resolvedRows.filter((r) => r.outcomeStatus === "AMBIGUOUS").length;
  const winLoss = wins + losses;
  const rs = resolvedRows
    .map((r) => r.outcomeR)
    .filter((n): n is number => typeof n === "number" && Number.isFinite(n));

  let winRatePct: number | null = null;
  let note = "Insufficient resolved WIN/LOSS sample — rate withheld.";
  if (winLoss >= minSample) {
    winRatePct = (wins / winLoss) * 100;
    note = `Rate uses ${winLoss} WIN+LOSS (min ${minSample}). Ambiguous excluded from win%.`;
  } else if (winLoss > 0) {
    note = `Only ${winLoss} WIN+LOSS (need ${minSample}) — rate withheld.`;
  }

  return {
    key,
    sampleSize: rows.length,
    resolved: resolvedRows.length,
    wins,
    losses,
    ambiguous,
    winRatePct,
    avgOutcomeR: rs.length ? rs.reduce((a, b) => a + b, 0) / rs.length : null,
    liveValidatedCount: rows.filter((r) => r.liveValidated).length,
    actionableCount: rows.filter((r) => r.actionable).length,
    note,
  };
}
