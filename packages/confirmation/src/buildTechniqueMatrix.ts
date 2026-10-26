import {
  buildConditionMatrix,
  CONDITION_LABELS,
  computeRiskRewardAtEntry,
  conservativeEntryPriceForRisk,
  isEntryZoneExecutable,
  type ConditionMatrix,
  type ConditionRow,
  type TradeLevels,
} from "@wulu/domain";
import type { ConfirmationProfile, FreshnessResult, MarketSnapshot } from "@wulu/market-data";
import type { WhyMovingBlock } from "@wulu/news";
import type { TechniqueEvaluation } from "@wulu/strategies";
import { evaluateLiquidity } from "./liquidity.js";

export interface TechniqueMatrixResult {
  matrix: ConditionMatrix;
  zoneExecutable: boolean;
  rewardToRisk: number;
}

export function buildTechniqueConditionMatrix(input: {
  technique: TechniqueEvaluation;
  levels: TradeLevels;
  snapshot: MarketSnapshot;
  freshness: FreshnessResult;
  whyMoving: WhyMovingBlock;
  profile?: ConfirmationProfile;
  evaluatedAt?: Date;
}): TechniqueMatrixResult {
  const profile = input.profile;
  const maxSpread = profile?.maxSpreadPct ?? 0.2;
  const minRr = profile?.minRewardToRisk ?? 2;
  const evalNow = input.evaluatedAt ?? input.snapshot.receivedAt;

  const liquidity = evaluateLiquidity(input.snapshot.quote, maxSpread, {
    maxQuoteAgeMs: profile?.maxDataAgeMs,
    now: evalNow,
  });

  const zoneExecutable = isEntryZoneExecutable(input.levels, input.snapshot.lastPrice);
  const entryForRr = conservativeEntryPriceForRisk(input.levels, input.snapshot.lastPrice);
  const rr = computeRiskRewardAtEntry(input.levels, entryForRr, minRr);

  const baseRows: ConditionRow[] = [
    row(
      "DATA_FRESHNESS",
      input.freshness.ok ? "PASS" : "FAIL",
      input.freshness.reason + (profile ? ` [${profile.session}]` : ""),
      true,
    ),
    row(
      "LIQUIDITY",
      liquidity.pass ? "PASS" : liquidity.fail ? "FAIL" : "WAITING",
      liquidity.reason,
      true,
    ),
    row(
      "NEWS_CATALYST",
      input.whyMoving.hasVerifiedCatalyst ? "PASS" : "WAITING",
      input.whyMoving.hasVerifiedCatalyst
        ? `Catalyst: ${input.whyMoving.whyMoving}`
        : "No verified news catalyst — optional",
      false,
    ),
  ];

  const byId = new Map<string, ConditionRow>();
  for (const r of baseRows) byId.set(r.id, r);

  for (const c of input.technique.checks) {
    byId.set(c.id, {
      id: c.id,
      label: CONDITION_LABELS[c.id],
      status: c.status,
      reason: c.reason,
      requiredForEntry: c.requiredForEntry,
    });
  }

  if (!byId.has("RISK_REWARD")) {
    byId.set(
      "RISK_REWARD",
      row(
        "RISK_REWARD",
        rr.meetsMinimum ? "PASS" : zoneExecutable ? "FAIL" : "WAITING",
        rr.meetsMinimum
          ? `R:R ${rr.rewardToRisk.toFixed(2)}R >= ${minRr}R`
          : `R:R ${rr.rewardToRisk.toFixed(2)}R — technique levels`,
        true,
      ),
    );
  }

  const rows = [...byId.values()];
  return {
    matrix: buildConditionMatrix(rows),
    zoneExecutable,
    rewardToRisk: rr.rewardToRisk,
  };
}

function row(
  id: ConditionRow["id"],
  status: ConditionRow["status"],
  reason: string,
  requiredForEntry: boolean,
): ConditionRow {
  return {
    id,
    label: CONDITION_LABELS[id],
    status,
    reason,
    requiredForEntry,
  };
}
