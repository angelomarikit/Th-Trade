import type { LiveSetupCard } from "@wulu/confirmation";
import { deriveTradingAction } from "@wulu/confirmation";
import { EVALUATION_CALIBRATION_SCHEMA_VERSION } from "./versions.js";

export interface EvaluationCalibrationV1 {
  schemaVersion: typeof EVALUATION_CALIBRATION_SCHEMA_VERSION;
  evaluationId: string;
  setupId: string;
  evaluatedAt: string;
  session: string | null;
  labMode: boolean;
  mockRth: boolean;
  tradingAction: string;
  qualityScore10: number | null;
  activeTechnique: {
    strategyId: string;
    strategyName: string;
    family: string;
    phase: string;
    statusReason: string;
    htfTrend: string;
  } | null;
  retest: {
    phase: string;
    retestRequired: boolean;
    reason: string;
    model: string;
  } | null;
  matrixSummary: {
    passed: number;
    total: number;
    blocking: Array<{ id: string; label: string; reason: string }>;
    htf1h: string | null;
    htf15m: string | null;
  };
  levels: {
    lastPrice: number;
    alertAt: number;
    entryLow: number;
    entryHigh: number;
    stop: number;
    target1: number;
    rewardToRisk: number;
  };
}

export function buildEvaluationCalibrationV1(card: LiveSetupCard): EvaluationCalibrationV1 {
  const blocking = card.matrix.rows
    .filter((r) => r.requiredForEntry && (r.status === "FAIL" || r.status === "WAITING"))
    .map((r) => ({ id: r.id, label: r.label, reason: r.reason }));

  const rowStatus = (id: string): string | null =>
    card.matrix.rows.find((r) => r.id === id)?.status ?? null;

  const tech = card.activeTechnique;

  return {
    schemaVersion: EVALUATION_CALIBRATION_SCHEMA_VERSION,
    evaluationId: `${card.setupId}@${card.evaluatedAt}`,
    setupId: card.setupId,
    evaluatedAt: card.evaluatedAt,
    session: card.session?.session ?? null,
    labMode: card.labMode === true,
    mockRth: card.mockRth === true,
    tradingAction: deriveTradingAction({
      state: card.state,
      statusLabel: card.statusLabel,
      userStatus: card.statusLabel,
      dataFresh: card.dataFresh,
      entryExecutable: card.entryZone.executable,
      rewardToRisk: card.rewardToRisk,
    }),
    qualityScore10: card.qualityScore10?.score ?? null,
    activeTechnique: tech
      ? {
          strategyId: tech.strategyId,
          strategyName: tech.strategyName,
          family: tech.family,
          phase: tech.phase,
          statusReason: tech.statusReason,
          htfTrend: tech.htfTrend,
        }
      : null,
    retest: card.signalIntelligence?.retest
      ? {
          phase: card.signalIntelligence.retest.phase,
          retestRequired: card.signalIntelligence.retest.retestRequired,
          reason: card.signalIntelligence.retest.reason,
          model: card.signalIntelligence.retest.model,
        }
      : null,
    matrixSummary: {
      passed: card.conditionsPassed,
      total: card.conditionsTotal,
      blocking,
      htf1h: rowStatus("HTF_1H"),
      htf15m: rowStatus("HTF_15M"),
    },
    levels: {
      lastPrice: card.lastPrice,
      alertAt: card.alertAt,
      entryLow: card.entryZone.low,
      entryHigh: card.entryZone.high,
      stop: card.stop,
      target1: card.target1,
      rewardToRisk: card.rewardToRisk,
    },
  };
}
