import type { DecisionJournalEntry } from "./api";

/** Stable key for “did the visible decision change?” */
export function decisionChangeKey(e: DecisionJournalEntry): string {
  return [
    e.tradingAction ?? "",
    e.state,
    e.statusLabel ?? "",
    e.retestPhase ?? "",
    e.strategyPhase ?? "",
    e.strategyId ?? "",
  ].join("|");
}

/** Newest-first rows where action, state, phase, or strategy shifted. */
export function decisionHistoryChanges(entries: DecisionJournalEntry[]): DecisionJournalEntry[] {
  const asc = [...entries].sort((a, b) => a.decisionAt.localeCompare(b.decisionAt));
  const changes: DecisionJournalEntry[] = [];
  let prev: string | null = null;
  for (const e of asc) {
    const key = decisionChangeKey(e);
    if (key !== prev) {
      changes.push(e);
      prev = key;
    }
  }
  return changes.reverse();
}

export function actionTone(action: string | null | undefined): string {
  const a = (action ?? "").toUpperCase();
  if (a === "ENTER") return "tone-entry";
  if (a === "WAIT") return "tone-wait";
  if (a === "SKIP" || a === "INVALIDATED") return "tone-exit";
  return "tone-none";
}
