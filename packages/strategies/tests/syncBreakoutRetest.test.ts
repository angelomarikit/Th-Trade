import { describe, expect, it } from "vitest";
import { syncBreakoutRetestTechnique } from "../src/techniques/syncBreakoutRetest.js";
import type { TechniqueEvaluation } from "../src/techniques/types.js";

function baseTechnique(): TechniqueEvaluation {
  return {
    strategyId: "BREAKOUT_RETEST_LONG",
    strategyName: "Breakout + Retest",
    family: "breakoutRetest",
    side: "LONG",
    relevanceScore: 60,
    phase: "RETESTING",
    levels: {
      side: "LONG",
      trigger: 396,
      entryZoneLow: 395,
      entryZoneHigh: 397,
      stop: 390,
      target1: 405,
      target2: 410,
      invalidation: 390,
    },
    checks: [
      {
        id: "STRUCTURE",
        status: "PASS",
        reason: "old",
        requiredForEntry: true,
      },
    ],
    invalidationRules: [],
    trendContext: "",
    entryTriggerDescription: "",
    statusReason: "old",
    htfTrend: "BULLISH",
  };
}

describe("syncBreakoutRetestTechnique", () => {
  it("maps RETEST_FAILED to FAILED_BREAK and STRUCTURE FAIL", () => {
    const out = syncBreakoutRetestTechnique(baseTechnique(), {
      phase: "RETEST_FAILED",
      reason: "Failed break sticky",
      retestRequired: true,
    });
    expect(out.phase).toBe("FAILED_BREAK");
    expect(out.checks[0]?.status).toBe("FAIL");
    expect(out.statusReason).toMatch(/Failed break/i);
  });
});
