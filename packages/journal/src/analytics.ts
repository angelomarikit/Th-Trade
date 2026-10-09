import type { JournalEntry } from "./types.js";

export interface JournalAnalytics {
  totalEvaluations: number;
  byState: Record<string, number>;
  entryActiveCount: number;
  closedTrades: number;
  openTrades: number;
  averageSetupScore: number | null;
  closedExpectancyR: number | null;
  closedWinRate: number | null;
  averageMfeR: number | null;
  averageMaeR: number | null;
}

export function summarizeJournal(entries: JournalEntry[]): JournalAnalytics {
  const byState: Record<string, number> = {};
  for (const e of entries) {
    byState[e.state] = (byState[e.state] ?? 0) + 1;
  }

  const closed = entries.filter((e) => e.outcome.status === "CLOSED");
  const open = entries.filter((e) => e.outcome.status === "OPEN");
  const closedRs = closed
    .map((e) => e.outcome.rMultiple)
    .filter((r): r is number => r != null);
  const wins = closedRs.filter((r) => r > 0);

  const scores = entries.map((e) => e.setupScore);
  const mfes = closed
    .map((e) => e.outcome.mfeR)
    .filter((r): r is number => r != null);
  const maes = closed
    .map((e) => e.outcome.maeR)
    .filter((r): r is number => r != null);

  return {
    totalEvaluations: entries.length,
    byState,
    entryActiveCount:
      (byState.ENTRY_ACTIVE_LONG ?? 0) + (byState.ENTRY_ACTIVE_SHORT ?? 0),
    closedTrades: closed.length,
    openTrades: open.length,
    averageSetupScore: scores.length
      ? scores.reduce((a, b) => a + b, 0) / scores.length
      : null,
    closedExpectancyR: closedRs.length
      ? closedRs.reduce((a, b) => a + b, 0) / closedRs.length
      : null,
    closedWinRate: closedRs.length ? wins.length / closedRs.length : null,
    averageMfeR: mfes.length ? mfes.reduce((a, b) => a + b, 0) / mfes.length : null,
    averageMaeR: maes.length ? maes.reduce((a, b) => a + b, 0) / maes.length : null,
  };
}
