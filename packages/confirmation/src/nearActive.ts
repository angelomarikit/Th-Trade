import type { ConditionMatrix, SetupState, TradeLevels } from "@wulu/domain";

export interface NearActiveView {
  active: boolean;
  conditionsPassed: number;
  conditionsTotal: number;
  trigger: number;
  distanceToTriggerAbs: number;
  distanceToTriggerPct: number;
  stillWaitingFor: string[];
  statusLabel: string;
}

export function buildNearActiveView(input: {
  state: SetupState;
  matrix: ConditionMatrix;
  levels: TradeLevels;
  lastPrice: number;
}): NearActiveView {
  const { state, matrix, levels, lastPrice } = input;
  const distanceAbs = lastPrice - levels.trigger;
  const distancePct = levels.trigger !== 0 ? (distanceAbs / levels.trigger) * 100 : 0;

  return {
    active: state === "NEAR_ACTIVE",
    conditionsPassed: matrix.passed,
    conditionsTotal: matrix.total,
    trigger: levels.trigger,
    distanceToTriggerAbs: distanceAbs,
    distanceToTriggerPct: distancePct,
    stillWaitingFor: matrix.waitingFor,
    statusLabel:
      state === "NEAR_ACTIVE"
        ? "NEAR ACTIVE"
        : state === "ENTRY_ACTIVE_LONG"
          ? "ENTRY ACTIVE — LONG"
          : state === "ENTRY_ACTIVE_SHORT"
            ? "ENTRY ACTIVE — SHORT"
            : state.replaceAll("_", " "),
  };
}
