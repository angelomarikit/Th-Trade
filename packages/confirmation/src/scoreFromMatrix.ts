import { computeSetupScore, type ConditionMatrix, type SetupScore } from "@wulu/domain";

export function setupScoreFromMatrix(
  matrix: ConditionMatrix,
  extras?: {
    catalystQuality?: number;
    priceReaction?: number;
    marketAlignment?: number;
    sectorAlignment?: number;
  },
): SetupScore {
  const get = (id: string) => matrix.rows.find((r) => r.id === id)?.status;

  const scoreStatus = (status: string | undefined, pass = 100, wait = 45, fail = 10) => {
    if (status === "PASS") return pass;
    if (status === "WAITING") return wait;
    if (status === "FAIL") return fail;
    return 40;
  };

  return computeSetupScore({
    technicalStructure: scoreStatus(get("STRUCTURE")),
    volume: scoreStatus(get("RELATIVE_VOLUME")),
    relativeVolume: scoreStatus(get("RELATIVE_VOLUME")),
    marketAlignment: extras?.marketAlignment ?? scoreStatus(get("MARKET_REGIME"), 80, 50, 20),
    sectorAlignment: extras?.sectorAlignment ?? scoreStatus(get("SECTOR_ALIGNMENT"), 80, 50, 20),
    catalystQuality: extras?.catalystQuality ?? scoreStatus(get("NEWS_CATALYST"), 85, 35, 20),
    priceReactionToCatalyst: extras?.priceReaction ?? 50,
    liquidity: scoreStatus(get("LIQUIDITY"), 100, 40, 15),
    riskReward: scoreStatus(get("RISK_REWARD")),
    dataQuality: scoreStatus(get("DATA_FRESHNESS"), 100, 30, 0),
  });
}
