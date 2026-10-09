import { isEntryActive, type SetupState, type TradeSide } from "@wulu/domain";
import { pickBestContract } from "./ranker.js";
import type {
  ContractRankerConfig,
  OptionRight,
  OptionsChainProvider,
  OptionsEngineResult,
} from "./types.js";
import { DEFAULT_RANKER_CONFIG } from "./types.js";

export interface OptionsEngineInput {
  enabled: boolean;
  underlyingState: SetupState;
  side: TradeSide;
  underlying: string;
  provider: OptionsChainProvider;
  config?: ContractRankerConfig;
}

/**
 * Options contract architecture.
 * - Feature flag must be on
 * - Underlying must be ENTRY ACTIVE first
 * - Never submits orders
 */
export class OptionsEngine {
  constructor(
    private readonly provider: OptionsChainProvider,
    private readonly config: ContractRankerConfig = DEFAULT_RANKER_CONFIG,
  ) {}

  async evaluate(input: {
    enabled: boolean;
    underlyingState: SetupState;
    side: TradeSide;
    underlying: string;
  }): Promise<OptionsEngineResult> {
    const base = {
      enabled: input.enabled,
      underlyingState: input.underlyingState,
      automaticOrders: false as const,
    };

    if (!input.enabled) {
      return {
        ...base,
        eligible: false,
        reason: "FEATURE_OPTIONS_ENGINE=false — options engine disabled",
        direction: null,
        best: null,
        candidatesConsidered: 0,
        rejectedCount: 0,
      };
    }

    if (!isEntryActive(input.underlyingState)) {
      return {
        ...base,
        eligible: false,
        reason: `Underlying must be ENTRY ACTIVE first (current: ${input.underlyingState})`,
        direction: null,
        best: null,
        candidatesConsidered: 0,
        rejectedCount: 0,
      };
    }

    const direction: OptionRight = input.side === "LONG" ? "CALL" : "PUT";
    const chain = await this.provider.getChain({
      underlying: input.underlying,
      side: input.side,
      minDte: this.config.minDte,
      maxDte: this.config.maxDte,
      targetDte: 21,
    });

    const { best, considered, rejected } = pickBestContract(
      chain,
      direction,
      this.config,
    );

    if (!best) {
      return {
        ...base,
        eligible: false,
        reason: "No eligible contracts after liquidity/spread/delta filters",
        direction,
        best: null,
        candidatesConsidered: considered,
        rejectedCount: rejected,
      };
    }

    return {
      ...base,
      eligible: true,
      reason: "Best contract candidate ranked — NOT an order",
      direction,
      best,
      candidatesConsidered: considered,
      rejectedCount: rejected,
    };
  }
}

export function formatBestContractCard(result: OptionsEngineResult): string | null {
  if (!result.best) return null;
  const c = result.best.contract;
  return [
    "BEST CONTRACT CANDIDATE",
    `${c.right}`,
    `Strike: ${c.strike}`,
    `Expiration: ${c.expiration}`,
    `DTE: ${c.dte}`,
    `Delta: ${c.delta ?? "—"}`,
    `Bid: ${c.bid}`,
    `Ask: ${c.ask}`,
    `Spread: ${c.spread.toFixed(2)} (${c.spreadPct.toFixed(1)}%)`,
    `Volume: ${c.volume}`,
    `Open Interest: ${c.openInterest}`,
    "WHY THIS CONTRACT",
    ...result.best.whyThisContract.map((w) => `- ${w}`),
    "NO AUTOMATIC ORDER EXECUTION",
  ].join("\n");
}
