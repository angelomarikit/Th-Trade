import {
  buildConditionMatrix,
  CONDITION_LABELS,
  computeRiskReward,
  isEntryZoneExecutable,
  type ConditionMatrix,
  type ConditionRow,
  type TradeLevels,
  type TradeSide,
} from "@wulu/domain";
import type {
  ConfirmationProfile,
  FreshnessResult,
  MarketSnapshot,
} from "@wulu/market-data";
import type { WhyMovingBlock } from "@wulu/news";
import { evaluateFiveMinConfirmation } from "./fiveMinConfirmation.js";
import { evaluateLiquidity } from "./liquidity.js";
import { evaluateStructure } from "./structure.js";
import { evaluateVolumeConfirmation } from "./volume.js";
import { evaluateVwap } from "./vwap.js";

export interface AlignmentInput {
  status: "PASS" | "WAITING" | "FAIL" | "N_A";
  reason: string;
}

export interface MatrixBuildInput {
  side: TradeSide;
  snapshot: MarketSnapshot;
  freshness: FreshnessResult;
  levels: TradeLevels;
  whyMoving: WhyMovingBlock;
  marketRegime?: AlignmentInput;
  sectorAlignment?: AlignmentInput;
  profile?: ConfirmationProfile;
}

export interface MatrixBuildResult {
  matrix: ConditionMatrix;
  fiveMinWaiting: boolean;
  volumeWaiting: boolean;
  zoneExecutable: boolean;
  rewardToRisk: number;
}

export function buildSetupConditionMatrix(input: MatrixBuildInput): MatrixBuildResult {
  const { side, snapshot, freshness, levels, whyMoving } = input;
  const profile = input.profile;
  const minRvol = profile?.minRelativeVolume ?? 1.2;
  const maxSpread = profile?.maxSpreadPct ?? 0.35;
  const minRr = profile?.minRewardToRisk ?? 1.5;
  const regimeRequired = profile?.requireRegimeAlignmentForEntry ?? false;
  const sectorRequired = profile?.requireSectorAlignmentForEntry ?? false;

  const five = evaluateFiveMinConfirmation(snapshot.bars5m, side, levels.trigger);
  const volume = evaluateVolumeConfirmation(snapshot.bars5m, minRvol);
  const structure = evaluateStructure(snapshot.bars5m, side);
  const vwap = evaluateVwap(
    snapshot.bars1m.length ? snapshot.bars1m : snapshot.bars5m,
    snapshot.lastPrice,
    side,
  );
  const liquidity = evaluateLiquidity(snapshot.quote, maxSpread);
  const rr = computeRiskReward(levels, minRr);
  const zoneExecutable = isEntryZoneExecutable(levels, snapshot.lastPrice);

  const regimeStatus = input.marketRegime?.status ?? "WAITING";
  const sectorStatus = input.sectorAlignment?.status ?? "WAITING";

  const rows: ConditionRow[] = [
    row(
      "DATA_FRESHNESS",
      freshness.ok ? "PASS" : "FAIL",
      freshness.reason + (profile ? ` [${profile.session}]` : ""),
      true,
    ),
    row(
      "LIQUIDITY",
      liquidity.pass ? "PASS" : liquidity.fail ? "FAIL" : "WAITING",
      liquidity.reason,
      true,
    ),
    row(
      "MARKET_REGIME",
      regimeStatus,
      input.marketRegime?.reason ?? "Market regime unavailable — WAITING",
      regimeRequired,
    ),
    row(
      "SECTOR_ALIGNMENT",
      sectorStatus,
      input.sectorAlignment?.reason ?? "Sector alignment unavailable — WAITING",
      sectorRequired,
    ),
    row(
      "RELATIVE_VOLUME",
      volume.pass ? "PASS" : volume.waiting ? "WAITING" : "FAIL",
      volume.reason,
      true,
    ),
    row(
      "VWAP",
      vwap.pass ? "PASS" : vwap.waiting ? "WAITING" : "FAIL",
      vwap.reason,
      true,
    ),
    row(
      "STRUCTURE",
      structure.pass ? "PASS" : structure.waiting ? "WAITING" : "FAIL",
      structure.reason,
      true,
    ),
    row(
      "NEWS_CATALYST",
      whyMoving.hasVerifiedCatalyst ? "PASS" : "WAITING",
      whyMoving.hasVerifiedCatalyst
        ? `Catalyst: ${whyMoving.whyMoving}`
        : "NO VERIFIED NEWS CATALYST FOUND — not inventing; WAITING",
      false,
    ),
    row(
      "FIVE_MIN_CONFIRMATION",
      five.pass ? "PASS" : five.waiting ? "WAITING" : "FAIL",
      five.reason,
      true,
    ),
    row(
      "RISK_REWARD",
      rr.meetsMinimum ? "PASS" : zoneExecutable ? "WAITING" : "FAIL",
      rr.meetsMinimum
        ? `R:R PASS: ${rr.rewardToRisk.toFixed(2)} >= ${rr.minimumRequired}`
        : `Waiting for acceptable R:R (${rr.rewardToRisk.toFixed(2)} < ${rr.minimumRequired})`,
      true,
    ),
  ];

  return {
    matrix: buildConditionMatrix(rows),
    fiveMinWaiting: five.waiting,
    volumeWaiting: volume.waiting,
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
