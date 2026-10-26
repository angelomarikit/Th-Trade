import { createHash, randomUUID } from "node:crypto";
import type { LiveSetupCard } from "@wulu/confirmation";
import type { Bar } from "@wulu/market-data";
import {
  assertNoFeatureLeakage,
  buildFeatureSnapshotV1,
} from "./featureSnapshot.js";
import { buildEvaluationCalibrationV1 } from "./evaluationSnapshot.js";
import { EvaluationPersistGate } from "./evaluationPersistGate.js";
import {
  calibrationRowsFromEntries,
  calibrationToCsv,
  calibrationToJson,
} from "./calibrationExport.js";
import { trackOutcomeFromBars } from "./outcomeTracker.js";
import type { JournalEntry, JournalQuery, JournalStore, SignalOutcome } from "./types.js";
import {
  FEATURE_SCHEMA_VERSION,
  JOURNAL_SCHEMA_VERSION,
  STRATEGY_DEFINITIONS_VERSION,
} from "./versions.js";

export class SignalJournal {
  private readonly evaluationGate = new EvaluationPersistGate();

  constructor(private readonly store: JournalStore) {}

  /**
   * Record evaluated setups when state, 5m bar, retest, or technique phase changes.
   */
  record(card: LiveSetupCard): JournalEntry | null {
    if (!this.evaluationGate.shouldRecord(card)) {
      return null;
    }
    const features = buildFeatureSnapshotV1(card);
    const calibration = buildEvaluationCalibrationV1(card);
    assertNoFeatureLeakage(features, card.evaluatedAt);

    const primaryStrategy = card.matchedStrategies[0] ?? null;
    const entry: JournalEntry = {
      id: makeId(card),
      journalSchemaVersion: JOURNAL_SCHEMA_VERSION,
      featureSchemaVersion: FEATURE_SCHEMA_VERSION,
      strategyDefinitionsVersion: STRATEGY_DEFINITIONS_VERSION,
      recordedAt: new Date().toISOString(),
      decisionAt: card.evaluatedAt,
      symbol: card.symbol,
      side: card.side,
      state: card.state,
      statusLabel: card.statusLabel,
      strategyId: primaryStrategy?.strategyId ?? card.historicalEdge?.strategyId ?? null,
      strategyName: primaryStrategy?.strategyName ?? card.historicalEdge?.strategyName ?? null,
      marketRegime: card.regime?.primary ?? null,
      marketBias: card.regime?.bias ?? null,
      hasCatalyst: card.whyMoving.hasVerifiedCatalyst,
      whyMoving: card.whyMoving.whyMoving,
      entry: (card.entryZone.low + card.entryZone.high) / 2,
      stop: card.stop,
      target1: card.target1,
      target2: card.target2,
      setupScore: card.setupScore.total,
      conditionsPassed: card.conditionsPassed,
      conditionsTotal: card.conditionsTotal,
      payload: {
        matrix: card.matrix,
        nearActive: card.nearActive,
        whyMoving: card.whyMoving,
        regime: card.regime,
        historicalEdge: card.historicalEdge,
        matchedStrategies: card.matchedStrategies,
        activeTechnique: card.activeTechnique,
        signalIntelligence: card.signalIntelligence,
        setupScore: card.setupScore,
        setupId: card.setupId,
      },
      features,
      calibration,
      outcome: initialOutcome(card.state),
    };

    this.store.insert(entry);
    return entry;
  }

  get(id: string): JournalEntry | null {
    return this.store.getById(id);
  }

  list(query?: JournalQuery): JournalEntry[] {
    return this.store.list(query);
  }

  count(query?: JournalQuery): number {
    return this.store.count(query);
  }

  updateOutcome(id: string, outcome: SignalOutcome): boolean {
    return this.store.updateOutcome(id, outcome);
  }

  /**
   * Refresh outcomes for open ENTRY ACTIVE rows using later bars.
   */
  refreshOutcomes(input: {
    symbol: string;
    bars: Bar[];
    maxHoldBars?: number;
  }): number {
    const open = this.store.list({
      symbol: input.symbol,
      limit: 500,
    }).filter(
      (e) =>
        e.outcome.status === "OPEN" &&
        (e.state === "ENTRY_ACTIVE_LONG" || e.state === "ENTRY_ACTIVE_SHORT"),
    );

    let updated = 0;
    for (const entry of open) {
      const outcome = trackOutcomeFromBars(entry, input.bars, {
        maxHoldBars: input.maxHoldBars,
      });
      if (this.store.updateOutcome(entry.id, outcome)) updated += 1;
    }
    return updated;
  }

  /** Export feature rows for research — outcomes joined separately to avoid accidental leakage. */
  exportCalibration(query?: JournalQuery, format: "json" | "csv" = "json"): string {
    const entries = this.store.list({ ...query, limit: query?.limit ?? 10_000 });
    const rows = calibrationRowsFromEntries(entries);
    return format === "csv" ? calibrationToCsv(rows) : calibrationToJson(rows);
  }

  exportCalibrationRows(query?: JournalQuery) {
    return calibrationRowsFromEntries(
      this.store.list({ ...query, limit: query?.limit ?? 10_000 }),
    );
  }

  /** @internal test helper */
  resetEvaluationGate(): void {
    this.evaluationGate.reset();
  }

  exportFeatureRows(query?: JournalQuery): Array<{
    id: string;
    features: JournalEntry["features"];
    outcome: SignalOutcome;
  }> {
    return this.store.list({ ...query, limit: query?.limit ?? 10_000 }).map((e) => ({
      id: e.id,
      features: e.features,
      outcome: e.outcome,
    }));
  }

  close(): void {
    this.store.close();
  }
}

function initialOutcome(state: LiveSetupCard["state"]): SignalOutcome {
  if (state === "ENTRY_ACTIVE_LONG" || state === "ENTRY_ACTIVE_SHORT") {
    return {
      status: "OPEN",
      exitPrice: null,
      exitAt: null,
      rMultiple: null,
      mfeR: null,
      maeR: null,
      barsHeld: null,
      exitReason: null,
      labeledAt: null,
    };
  }
  return {
    status: "NOT_APPLICABLE",
    exitPrice: null,
    exitAt: null,
    rMultiple: null,
    mfeR: null,
    maeR: null,
    barsHeld: null,
    exitReason: "NONE",
    labeledAt: new Date().toISOString(),
  };
}

function makeId(card: LiveSetupCard): string {
  const basis = [
    card.symbol,
    card.side,
    card.state,
    card.evaluatedAt,
    card.alertAt.toFixed(4),
    randomUUID().slice(0, 8),
  ].join("|");
  return createHash("sha256").update(basis).digest("hex").slice(0, 24);
}
