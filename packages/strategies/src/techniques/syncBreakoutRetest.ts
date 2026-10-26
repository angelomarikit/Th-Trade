import type { TechniqueEvaluation } from "./types.js";

export interface RetestPhaseSnapshot {
  phase: string;
  reason: string;
  retestRequired: boolean;
}

function mapPhase(retestPhase: string, fallback: string): string {
  switch (retestPhase) {
    case "RETEST_FAILED":
      return "FAILED_BREAK";
    case "WAITING_RETEST":
    case "BROKE":
      return "BROKE";
    case "RETESTING":
      return "RETESTING";
    case "RETEST_HELD":
      return "RETEST_HELD";
    case "CONTINUATION_CONFIRMED":
      return "CONTINUATION";
    default:
      return fallback;
  }
}

/** Align Breakout+Retest technique phase + STRUCTURE row with persisted retest engine. */
export function syncBreakoutRetestTechnique(
  technique: TechniqueEvaluation,
  retest: RetestPhaseSnapshot,
): TechniqueEvaluation {
  if (technique.family !== "breakoutRetest") return technique;
  if (retest.phase === "NONE" && !retest.retestRequired) return technique;

  const phase = mapPhase(retest.phase, technique.phase);
  const failed = retest.phase === "RETEST_FAILED";
  const held =
    retest.phase === "RETEST_HELD" || retest.phase === "CONTINUATION_CONFIRMED";

  const checks = technique.checks.map((c) => {
    if (c.id !== "STRUCTURE") return c;
    if (failed) {
      return {
        ...c,
        status: "FAIL" as const,
        reason: retest.reason,
      };
    }
    if (held) {
      return {
        ...c,
        status: "PASS" as const,
        reason: retest.reason,
      };
    }
    if (
      retest.phase === "WAITING_RETEST" ||
      retest.phase === "RETESTING" ||
      retest.phase === "BROKE"
    ) {
      return {
        ...c,
        status: "WAITING" as const,
        reason: retest.reason,
      };
    }
    return c;
  });

  let statusReason = technique.statusReason;
  if (failed) {
    statusReason = retest.reason;
  } else if (retest.phase !== "NONE") {
    statusReason = `Breakout+retest ${phase} — ${retest.reason}`;
  }

  let relevanceScore = technique.relevanceScore;
  if (failed) relevanceScore = Math.min(relevanceScore, 15);
  else if (phase === "RETESTING" || phase === "RETEST_HELD") {
    relevanceScore = Math.max(relevanceScore, 50);
  }

  return {
    ...technique,
    phase,
    checks,
    statusReason,
    relevanceScore,
  };
}
