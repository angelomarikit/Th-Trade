import type { ConditionMatrix, SetupState, TradeLevels } from "@wulu/domain";

export const NEAR_ACTIVE_CONFIRMATION_REQUIREMENT =
  "ENTRY ACTIVE requires completed 5-minute confirmation, volume, structure, liquidity, minimum ~2R to Target 1 (unless strategy overrides), and fresh verified data. NEAR ACTIVE is never entry permission.";

export interface NearActiveView {
  active: boolean;
  conditionsPassed: number;
  conditionsTotal: number;
  trigger: number;
  /** Last − trigger (signed). */
  distanceToTriggerAbs: number;
  distanceToTriggerPct: number;
  /** Human-readable distance for mobile / decision cards. */
  distanceLabel: string;
  stillWaitingFor: string[];
  statusLabel: string;
  /** Exact confirmation gate text — Near Active ≠ enter. */
  confirmationRequirement: string;
  /** Always false by design. */
  permissionToEnter: false;
  dataTimestamp: string | null;
  setupQualityScore: number | null;
}

export function buildNearActiveView(input: {
  state: SetupState;
  matrix: ConditionMatrix;
  levels: TradeLevels;
  lastPrice: number;
  dataTimestamp?: string | null;
  setupQualityScore?: number | null;
}): NearActiveView {
  const { state, matrix, levels, lastPrice } = input;
  const distanceAbs = lastPrice - levels.trigger;
  const distancePct = levels.trigger !== 0 ? (distanceAbs / levels.trigger) * 100 : 0;
  const approach =
    Math.abs(distancePct) < 0.05
      ? "AT TRIGGER"
      : distanceAbs > 0
        ? `${distancePct.toFixed(2)}% ABOVE TRIGGER`
        : `${Math.abs(distancePct).toFixed(2)}% BELOW TRIGGER`;

  return {
    active: state === "NEAR_ACTIVE",
    conditionsPassed: matrix.passed,
    conditionsTotal: matrix.total,
    trigger: levels.trigger,
    distanceToTriggerAbs: distanceAbs,
    distanceToTriggerPct: distancePct,
    distanceLabel: approach,
    stillWaitingFor: matrix.waitingFor,
    statusLabel: statusLabelFor(state),
    confirmationRequirement: NEAR_ACTIVE_CONFIRMATION_REQUIREMENT,
    permissionToEnter: false,
    dataTimestamp: input.dataTimestamp ?? null,
    setupQualityScore: input.setupQualityScore ?? null,
  };
}

function statusLabelFor(state: SetupState): string {
  switch (state) {
    case "NEAR_ACTIVE":
      return "NEAR ACTIVE";
    case "ENTRY_ACTIVE_LONG":
      return "ENTRY ACTIVE — LONG";
    case "ENTRY_ACTIVE_SHORT":
      return "ENTRY ACTIVE — SHORT";
    case "MISSED":
      return "MISSED — DO NOT CHASE";
    case "INVALIDATED":
      return "INVALIDATED";
    case "DATA_NOT_VERIFIED":
      return "DATA NOT VERIFIED";
    case "NO_TRADE":
      return "NO TRADE";
    case "WAIT":
      return "WAIT";
    default: {
      const _exhaustive: never = state;
      return String(_exhaustive).replace(/_/g, " ");
    }
  }
}
