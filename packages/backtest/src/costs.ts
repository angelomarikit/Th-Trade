export interface CostModel {
  /** One-way spread cost as fraction of price (e.g. 0.0005 = 5 bps) */
  spreadFraction: number;
  /** One-way slippage fraction */
  slippageFraction: number;
  /** Flat fee per side in R-irrelevant dollars; applied as price drag when price known */
  feePerSide: number;
}

export const DEFAULT_COST_MODEL: CostModel = {
  spreadFraction: 0.0004,
  slippageFraction: 0.0003,
  feePerSide: 0,
};

/** Adverse entry adjustment for LONG (pay ask + slip). */
export function adjustEntryLong(price: number, costs: CostModel): number {
  const drag = price * (costs.spreadFraction / 2 + costs.slippageFraction) + costs.feePerSide;
  return price + drag;
}

export function adjustEntryShort(price: number, costs: CostModel): number {
  const drag = price * (costs.spreadFraction / 2 + costs.slippageFraction) + costs.feePerSide;
  return price - drag;
}

export function adjustExitLong(price: number, costs: CostModel): number {
  const drag = price * (costs.spreadFraction / 2 + costs.slippageFraction) + costs.feePerSide;
  return price - drag;
}

export function adjustExitShort(price: number, costs: CostModel): number {
  const drag = price * (costs.spreadFraction / 2 + costs.slippageFraction) + costs.feePerSide;
  return price + drag;
}
