import type { LiveSetupCard } from "./liveCard.js";

/** Foundation record for future strategy evaluation — not a published win-rate claim. */
export interface SignalPerformanceRecord {
  id: string;
  /** Supabase user id when known; null for anonymous / replay. */
  userId: string | null;
  symbol: string;
  side: string;
  strategyType: string;
  setupId: string;
  signalTimestamp: string;
  dataTimestamp: string | null;
  marketSession: string | null;
  trigger: number;
  entryZone: { low: number; high: number; executable: boolean };
  stop: number;
  target1: number;
  target2: number;
  target3: number | null;
  qualityScore10: number | null;
  setupScore100: number;
  falseBreakoutRisk: string | null;
  state: string;
  actionable: boolean;
  dataQualityOk: boolean;
  confirmationSummary: string[];
  outcomeStatus: "UNKNOWN" | "WIN" | "LOSS" | "BREAKEVEN" | "AMBIGUOUS" | "INVALIDATED" | "MISSED";
  outcomeR: number | null;
  source: "LIVE" | "HISTORICAL_REPLAY";
  /** Never true until operator-confirmed RTH validation. */
  liveValidated: boolean;
}

export interface SignalPerformanceStore {
  record(row: SignalPerformanceRecord): void;
  list(limit?: number): SignalPerformanceRecord[];
  summary(): {
    total: number;
    actionable: number;
    invalidated: number;
    missed: number;
    note: string;
  };
}

export class MemorySignalPerformanceStore implements SignalPerformanceStore {
  private rows: SignalPerformanceRecord[] = [];

  record(row: SignalPerformanceRecord): void {
    if (this.rows.some((r) => r.id === row.id)) return;
    this.rows.unshift(row);
    if (this.rows.length > 5_000) this.rows.length = 5_000;
  }

  /** Insert or replace by id (used for outcome updates / open-track rows). */
  upsert(row: SignalPerformanceRecord): void {
    const idx = this.rows.findIndex((r) => r.id === row.id);
    if (idx >= 0) this.rows[idx] = row;
    else this.rows.unshift(row);
    if (this.rows.length > 5_000) this.rows.length = 5_000;
  }

  list(limit = 100): SignalPerformanceRecord[] {
    return this.rows.slice(0, limit);
  }

  summary() {
    const resolved = this.rows.filter((r) => r.outcomeStatus !== "UNKNOWN");
    const wins = resolved.filter((r) => r.outcomeStatus === "WIN").length;
    const losses = resolved.filter((r) => r.outcomeStatus === "LOSS").length;
    return {
      total: this.rows.length,
      actionable: this.rows.filter((r) => r.actionable).length,
      invalidated: this.rows.filter((r) => r.state.includes("INVALIDATED")).length,
      missed: this.rows.filter((r) => r.state.includes("MISSED")).length,
      resolved: resolved.length,
      wins,
      losses,
      note: "Counts only — not a validated live win rate. Hypothetical outcomes use completed 5m bars; liveValidated stays false until RTH confirmation.",
    };
  }
}

export function cardToPerformanceRecord(
  card: LiveSetupCard,
  source: "LIVE" | "HISTORICAL_REPLAY" = "LIVE",
  userId: string | null = null,
): SignalPerformanceRecord {
  const entryActive =
    card.state === "ENTRY_ACTIVE_LONG" || card.state === "ENTRY_ACTIVE_SHORT";
  return {
    id: `${card.setupId}:${card.evaluatedAt}${userId ? `:${userId}` : ""}`,
    userId,
    symbol: card.symbol,
    side: card.side,
    strategyType: card.signalIntelligence?.entryModel ?? "SCANNER",
    setupId: card.setupId,
    signalTimestamp: card.evaluatedAt,
    dataTimestamp: card.nearActive.dataTimestamp,
    marketSession: card.session?.session ?? null,
    trigger: card.alertAt,
    entryZone: card.entryZone,
    stop: card.stop,
    target1: card.target1,
    target2: card.target2,
    target3: card.target3 ?? null,
    qualityScore10: card.qualityScore10?.score ?? null,
    setupScore100: card.setupScore.total,
    falseBreakoutRisk: card.signalIntelligence?.falseBreakoutRisk ?? null,
    state: card.state,
    actionable: entryActive && card.dataFresh && card.entryZone.executable,
    dataQualityOk: card.dataFresh,
    confirmationSummary: card.nearActive.stillWaitingFor.slice(0, 8),
    outcomeStatus:
      card.state === "INVALIDATED"
        ? "INVALIDATED"
        : card.state === "MISSED"
          ? "MISSED"
          : "UNKNOWN",
    outcomeR: null,
    source,
    liveValidated: false,
  };
}
