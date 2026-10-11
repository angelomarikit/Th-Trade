import type { ConditionMatrix } from "@wulu/domain";
import type { BreakoutAnalysis } from "./breakoutAnalysis.js";
import type { FakeBreakoutWarning } from "./fakeBreakout.js";
import { worstFakeBreakoutSeverity } from "./fakeBreakout.js";
import type { RetestState } from "./retest.js";

/**
 * Transparent 1–10 quality score. NOT win probability.
 * High score cannot override failed mandatory safety rows.
 */
export function scoreSetupQuality10(input: {
  matrix: ConditionMatrix;
  dataFresh: boolean;
  breakout: BreakoutAnalysis;
  fakeWarnings: FakeBreakoutWarning[];
  retest: RetestState;
  rvol: number | null;
  rewardToRisk: number;
  zoneExecutable: boolean;
}): { score: number; reasons: string[]; disclaimer: string } {
  const reasons: string[] = [];
  let score = 5;

  if (!input.dataFresh) {
    return {
      score: 1,
      reasons: ["Data not verified — score floored"],
      disclaimer: "Quality score is NOT win probability. Stale data blocks entries.",
    };
  }

  const required = input.matrix.rows.filter((r) => r.requiredForEntry);
  const requiredPassed = required.filter((r) => r.status === "PASS").length;
  const requiredFail = required.some((r) => r.status === "FAIL");
  score += Math.round((requiredPassed / Math.max(1, required.length)) * 3);
  reasons.push(`Required conditions ${requiredPassed}/${required.length} PASS`);

  if (input.breakout.mode === "CONFIRMED_CLOSE") {
    score += 1;
    reasons.push("Completed candle closed beyond level");
  } else if (input.breakout.mode === "APPROACHING" || input.breakout.mode === "BREAKING") {
    reasons.push(`Breakout mode: ${input.breakout.mode}`);
  } else if (input.breakout.mode === "FAILED_HOLD") {
    score -= 2;
    reasons.push("Failed hold at level");
  }

  if (input.breakout.bodyRatio != null && input.breakout.bodyRatio >= 0.5) {
    score += 1;
    reasons.push("Solid candle body on confirmation bar");
  }

  if (input.rvol != null && input.rvol >= 1.5) {
    score += 1;
    reasons.push(`RVOL ${input.rvol.toFixed(2)}x (IEX-limited)`);
  } else if (input.rvol != null && input.rvol < 1) {
    score -= 1;
    reasons.push("Weak relative volume");
  }

  if (input.rewardToRisk >= 2) {
    score += 1;
    reasons.push(`R:R ${input.rewardToRisk.toFixed(2)} to T1`);
  } else {
    score -= 1;
    reasons.push(`R:R ${input.rewardToRisk.toFixed(2)} below 2.0 target`);
  }

  if (input.retest.phase === "CONTINUATION_CONFIRMED" || input.retest.phase === "RETEST_HELD") {
    score += 1;
    reasons.push(`Retest phase: ${input.retest.phase}`);
  }
  if (input.retest.phase === "RETEST_FAILED") {
    score -= 2;
    reasons.push("Retest failed");
  }

  const fake = worstFakeBreakoutSeverity(input.fakeWarnings);
  if (fake === "CONFIRMED_FAIL") {
    score -= 3;
    reasons.push("Confirmed fake-breakout / trap pattern");
  } else if (fake === "HIGH" || fake === "MODERATE") {
    score -= 1;
    reasons.push(`False-breakout risk: ${fake}`);
  }

  if (input.zoneExecutable) reasons.push("Price inside entry zone");
  else reasons.push("Price outside entry zone");

  if (requiredFail) {
    score = Math.min(score, 4);
    reasons.push("Mandatory condition FAIL — score capped");
  }

  score = Math.max(1, Math.min(10, score));
  return {
    score,
    reasons,
    disclaimer:
      "Setup quality 1–10 is a transparency score, NOT a probability of profit. Mandatory fails still block ENTRY ACTIVE.",
  };
}
