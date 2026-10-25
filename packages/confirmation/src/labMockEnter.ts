import { buildConditionMatrix, type TradeLevels } from "@wulu/domain";
import type { LiveSetupCard } from "./liveCard.js";
import { buildNearActiveView } from "./nearActive.js";

const LAB_MOCK_REASON =
  "Lab mock enter — gates satisfied for paper drill only (not live permission).";

/**
 * Preview-only: after real evaluation on SIP replay, force ENTRY ACTIVE so mock
 * trading can exercise ENTER UX without weakening production scans.
 */
export function applyLabMockEnterDrill(card: LiveSetupCard): LiveSetupCard {
  const rows = card.matrix.rows.map((r) => {
    if (!r.requiredForEntry || r.status === "N_A") return r;
    if (r.status === "PASS") return r;
    return { ...r, status: "PASS" as const, reason: LAB_MOCK_REASON };
  });
  const matrix = buildConditionMatrix(rows);
  const state = card.side === "LONG" ? "ENTRY_ACTIVE_LONG" : "ENTRY_ACTIVE_SHORT";
  const levels: TradeLevels = {
    side: card.side,
    trigger: card.alertAt,
    entryZoneLow: card.entryZone.low,
    entryZoneHigh: card.entryZone.high,
    stop: card.stop,
    target1: card.target1,
    target2: card.target2,
    target3: card.target3 ?? undefined,
    invalidation: card.invalidation ?? undefined,
  };
  const zoneLow = Math.min(card.entryZone.low, card.entryZone.high);
  const zoneHigh = Math.max(card.entryZone.low, card.entryZone.high);
  const entryMid = (zoneLow + zoneHigh) / 2;
  const risk = Math.abs(entryMid - card.stop);
  const labTarget1 =
    risk > 0
      ? card.side === "LONG"
        ? entryMid + 2 * risk
        : entryMid - 2 * risk
      : card.target1;
  const rewardToRisk = risk > 0 ? 2 : Math.max(card.rewardToRisk ?? 0, 2);

  const nearActive = buildNearActiveView({
    state,
    matrix,
    levels: {
      ...levels,
      target1: labTarget1,
      entryZoneLow: zoneLow,
      entryZoneHigh: zoneHigh,
    },
    lastPrice: entryMid,
    dataTimestamp: card.evaluatedAt,
    setupQualityScore: card.setupScore.total,
  });

  const indicatorChecklist = card.indicatorChecklist?.map((row) =>
    row.gateStatus === "PASS"
      ? row
      : {
          ...row,
          gateStatus: "PASS" as const,
          bias:
            row.bias === "NOT VERIFIED" || row.bias === "NEUTRAL"
              ? ("BULLISH" as const)
              : row.bias,
          explanation: LAB_MOCK_REASON,
        },
  );

  return {
    ...card,
    state,
    statusLabel: nearActive.statusLabel,
    matrix,
    conditionsPassed: matrix.passed,
    conditionsTotal: matrix.total,
    nearActive,
    entryZone: { low: zoneLow, high: zoneHigh, executable: true },
    target1: labTarget1,
    lastPrice: entryMid,
    rewardToRisk,
    dataFresh: true,
    dataFreshReason: card.dataFreshReason ?? "Lab mock enter — verified for paper drill",
    mockEnter: true,
    labDisclaimer:
      "MOCK ENTER (lab) — price shaped in the entry zone with ~2R levels; gates PASS for paper drill only.",
    signalIntelligence: card.signalIntelligence
      ? {
          ...card.signalIntelligence,
          actionHint: "ENTRY ACTIVE — lab mock enter for paper drill",
        }
      : card.signalIntelligence,
    indicatorChecklist,
  };
}
