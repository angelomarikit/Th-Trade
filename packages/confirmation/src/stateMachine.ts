import {
  isEntryActive,
  type ConditionMatrix,
  type SetupState,
  type TradeSide,
} from "@wulu/domain";

export interface StateDecisionInput {
  side: TradeSide;
  matrix: ConditionMatrix;
  zoneExecutable: boolean;
  /** Prior state for MISSED / INVALIDATED transitions (optional) */
  previousState?: SetupState;
  /** Price left zone after having been near/active */
  leftExecutableZone?: boolean;
  /** Structure clearly broken vs thesis */
  structureInvalidated?: boolean;
}

/**
 * Deterministic setup state machine.
 * NEAR ACTIVE never becomes a trade without all required confirmation rules.
 * News cannot grant ENTRY ACTIVE (enforced by matrix required rows).
 */
export function decideSetupState(input: StateDecisionInput): SetupState {
  const { matrix, side, zoneExecutable } = input;

  const dataFresh = statusOf(matrix, "DATA_FRESHNESS");
  if (dataFresh === "FAIL") return "DATA_NOT_VERIFIED";

  const liquidity = statusOf(matrix, "LIQUIDITY");
  if (liquidity === "FAIL") return "NO_TRADE";

  if (input.structureInvalidated) return "INVALIDATED";

  if (
    input.leftExecutableZone &&
    (input.previousState === "NEAR_ACTIVE" ||
      input.previousState === "ENTRY_ACTIVE_LONG" ||
      input.previousState === "ENTRY_ACTIVE_SHORT")
  ) {
    return "MISSED";
  }

  const hardFails = matrix.rows.filter(
    (r) => r.requiredForEntry && r.status === "FAIL",
  );
  if (hardFails.length > 0) {
    return "NO_TRADE";
  }

  if (matrix.allRequiredPassed) {
    if (!zoneExecutable) {
      // Confirmation complete but zone no longer executable — never ENTRY ACTIVE
      return "MISSED";
    }
    return side === "LONG" ? "ENTRY_ACTIVE_LONG" : "ENTRY_ACTIVE_SHORT";
  }

  if (isNearActive(matrix)) {
    return "NEAR_ACTIVE";
  }

  return "WAIT";
}

/**
 * Near Active: legitimate setup forming — majority of rows PASS,
 * at least one required confirmation still WAITING, no required FAIL.
 */
export function isNearActive(matrix: ConditionMatrix): boolean {
  const required = matrix.rows.filter((r) => r.requiredForEntry);
  if (required.some((r) => r.status === "FAIL")) return false;
  if (required.every((r) => r.status === "PASS")) return false;

  const waitingRequired = required.filter((r) => r.status === "WAITING");
  if (waitingRequired.length === 0) return false;

  const passedRatio = matrix.total === 0 ? 0 : matrix.passed / matrix.total;
  const requiredPassed = required.filter((r) => r.status === "PASS").length;
  const requiredRatio = requiredPassed / required.length;

  // Most conditions passed OR most required passed, still waiting on confirmation pieces
  return passedRatio >= 0.5 || requiredRatio >= 0.5;
}

export function assertEntryNotFromNewsAlone(state: SetupState, matrix: ConditionMatrix): void {
  if (!isEntryActive(state)) return;
  const five = statusOf(matrix, "FIVE_MIN_CONFIRMATION");
  const vol = statusOf(matrix, "RELATIVE_VOLUME");
  const structure = statusOf(matrix, "STRUCTURE");
  const rr = statusOf(matrix, "RISK_REWARD");
  const data = statusOf(matrix, "DATA_FRESHNESS");
  if (
    five !== "PASS" ||
    vol !== "PASS" ||
    structure !== "PASS" ||
    rr !== "PASS" ||
    data !== "PASS"
  ) {
    throw new Error(
      "SAFETY: ENTRY ACTIVE without full confirmation matrix — forbidden",
    );
  }
}

function statusOf(matrix: ConditionMatrix, id: string) {
  return matrix.rows.find((r) => r.id === id)?.status;
}
