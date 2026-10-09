import type { SetupState, TradeSide } from "@wulu/domain";
import type { FeatureSnapshotV1 } from "./featureSnapshot.js";

export interface SignalOutcome {
  status: "OPEN" | "CLOSED" | "EXPIRED" | "NOT_APPLICABLE";
  exitPrice: number | null;
  exitAt: string | null;
  rMultiple: number | null;
  mfeR: number | null;
  maeR: number | null;
  barsHeld: number | null;
  exitReason: "TARGET" | "STOP" | "TIMEOUT" | "MANUAL" | "NONE" | null;
  /** Populated only after decision time — never mixed into feature vector training inputs without lag rules */
  labeledAt: string | null;
}

export interface JournalEntry {
  id: string;
  journalSchemaVersion: string;
  featureSchemaVersion: string;
  strategyDefinitionsVersion: string;
  recordedAt: string;
  /** Decision timestamp — features must be <= this instant */
  decisionAt: string;
  symbol: string;
  side: TradeSide;
  state: SetupState;
  statusLabel: string;
  strategyId: string | null;
  strategyName: string | null;
  marketRegime: string | null;
  marketBias: string | null;
  hasCatalyst: boolean;
  whyMoving: string;
  entry: number;
  stop: number;
  target1: number;
  target2: number;
  setupScore: number;
  conditionsPassed: number;
  conditionsTotal: number;
  /** Full card/matrix snapshot for audit */
  payload: unknown;
  /** Leakage-safe features for future ML research */
  features: FeatureSnapshotV1;
  outcome: SignalOutcome;
}

export interface JournalQuery {
  symbol?: string;
  state?: SetupState;
  strategyId?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

export interface JournalStore {
  insert(entry: JournalEntry): void;
  getById(id: string): JournalEntry | null;
  updateOutcome(id: string, outcome: SignalOutcome): boolean;
  list(query?: JournalQuery): JournalEntry[];
  count(query?: JournalQuery): number;
  close(): void;
}
