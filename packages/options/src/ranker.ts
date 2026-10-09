import type {
  ContractRankerConfig,
  OptionContract,
  OptionRight,
  RankedContract,
} from "./types.js";
import { DEFAULT_RANKER_CONFIG } from "./types.js";

/**
 * Rank eligible option contracts. Rejects unacceptable liquidity/spreads.
 * Never places orders.
 */
export function rankOptionContracts(
  contracts: OptionContract[],
  desiredRight: OptionRight,
  config: ContractRankerConfig = DEFAULT_RANKER_CONFIG,
): RankedContract[] {
  const ranked: RankedContract[] = [];

  for (const c of contracts) {
    if (c.right !== desiredRight) continue;
    const rejectReasons: string[] = [];
    const why: string[] = [];

    if (c.dte < config.minDte || c.dte > config.maxDte) {
      rejectReasons.push(`DTE ${c.dte} outside ${config.minDte}-${config.maxDte}`);
    }
    if (c.bid <= 0 || c.ask <= 0 || c.ask < c.bid) {
      rejectReasons.push("Invalid bid/ask");
    }
    if (c.spreadPct > config.maxSpreadPct) {
      rejectReasons.push(
        `Spread ${c.spreadPct.toFixed(1)}% > max ${config.maxSpreadPct}%`,
      );
    }
    if (c.volume < config.minVolume) {
      rejectReasons.push(`Volume ${c.volume} < min ${config.minVolume}`);
    }
    if (c.openInterest < config.minOpenInterest) {
      rejectReasons.push(`OI ${c.openInterest} < min ${config.minOpenInterest}`);
    }

    const absDelta = c.delta != null ? Math.abs(c.delta) : null;
    if (absDelta != null) {
      if (absDelta < config.minAbsDelta || absDelta > config.maxAbsDelta) {
        rejectReasons.push(
          `Delta ${absDelta.toFixed(2)} outside ${config.minAbsDelta}-${config.maxAbsDelta}`,
        );
      }
    }

    if (rejectReasons.length > 0) {
      ranked.push({
        contract: c,
        score: -1,
        rejectReasons,
        whyThisContract: [],
      });
      continue;
    }

    // Higher score is better
    let score = 100;
    score -= c.spreadPct * 2;
    if (absDelta != null) {
      score -= Math.abs(absDelta - config.targetAbsDelta) * 40;
      why.push(`Delta ${absDelta.toFixed(2)} near target ${config.targetAbsDelta}`);
    } else {
      score -= 5;
      why.push("Delta unavailable — slight penalty");
    }
    score += Math.min(15, Math.log10(Math.max(1, c.volume)) * 5);
    score += Math.min(15, Math.log10(Math.max(1, c.openInterest)) * 4);
    // Prefer mid-range DTE (~21)
    score -= Math.abs(c.dte - 21) * 0.35;

    why.push(`${c.right} strike ${c.strike}`);
    why.push(`Expiration ${c.expiration} (DTE ${c.dte})`);
    why.push(`Bid ${c.bid.toFixed(2)} / Ask ${c.ask.toFixed(2)} (spread ${c.spreadPct.toFixed(1)}%)`);
    why.push(`Volume ${c.volume}, OI ${c.openInterest}`);
    why.push("Selected for liquidity + delta band + spread — not auto-ordered");

    ranked.push({
      contract: c,
      score,
      rejectReasons: [],
      whyThisContract: why,
    });
  }

  return ranked.sort((a, b) => b.score - a.score);
}

export function pickBestContract(
  contracts: OptionContract[],
  desiredRight: OptionRight,
  config?: ContractRankerConfig,
): {
  best: RankedContract | null;
  considered: number;
  rejected: number;
  ranked: RankedContract[];
} {
  const ranked = rankOptionContracts(contracts, desiredRight, config);
  const eligible = ranked.filter((r) => r.score >= 0);
  return {
    best: eligible[0] ?? null,
    considered: ranked.length,
    rejected: ranked.length - eligible.length,
    ranked,
  };
}
