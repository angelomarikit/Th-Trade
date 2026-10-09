import type { Bar } from "@wulu/market-data";
import { getStrategy, listStrategies } from "@wulu/strategies";
import { runBacktest } from "./engine.js";
import {
  buildHistoricalEdgePanel,
  formatHistoricalEdgeText,
  type HistoricalEdgePanel,
} from "./edgePanel.js";
import { computeEdgeMetrics } from "./metrics.js";
import { runWalkForward } from "./walkForward.js";

export interface EdgeLookupInput {
  strategyId: string;
  symbol: string;
  bars: Bar[];
  regimePrimary?: string;
  hasCatalyst?: boolean;
  includeWalkForward?: boolean;
}

export class HistoricalEdgeService {
  /**
   * Compute historical edge from bars using the live strategy definition.
   * Prefer OOS / walk-forward fields when includeWalkForward is true.
   */
  compute(input: EdgeLookupInput): {
    panel: HistoricalEdgePanel;
    text: string;
  } {
    const strategy = getStrategy(input.strategyId);
    if (!strategy) {
      throw new Error(`Unknown strategy: ${input.strategyId}`);
    }

    const run = runBacktest({
      strategyId: input.strategyId,
      symbol: input.symbol,
      bars: input.bars,
      regimePrimary: input.regimePrimary,
      hasCatalyst: input.hasCatalyst,
    });

    const metrics = computeEdgeMetrics(run.trades);
    const walkForward = input.includeWalkForward
      ? runWalkForward({
          strategyId: input.strategyId,
          symbol: input.symbol,
          bars: input.bars,
          regimePrimary: input.regimePrimary,
          hasCatalyst: input.hasCatalyst,
        })
      : null;

    // Panel headline stats: if walk-forward requested, surface OOS sample when available
    const panelMetrics =
      walkForward && walkForward.outOfSample.sampleSize > 0
        ? walkForward.outOfSample
        : metrics;

    const panel = buildHistoricalEdgePanel({
      strategyId: strategy.id,
      strategyName: strategy.name,
      symbol: input.symbol,
      metrics: panelMetrics,
      regimeFilter: input.regimePrimary ?? null,
      walkForward,
    });

    return { panel, text: formatHistoricalEdgeText(panel) };
  }

  /**
   * Pick best matched strategy edge among candidates (by OOS expectancy, then sample size).
   */
  bestEdgeForMatches(input: {
    strategyIds: string[];
    symbol: string;
    bars: Bar[];
    regimePrimary?: string;
    hasCatalyst?: boolean;
  }): HistoricalEdgePanel | null {
    let best: HistoricalEdgePanel | null = null;
    for (const id of input.strategyIds) {
      try {
        const { panel } = this.compute({
          strategyId: id,
          symbol: input.symbol,
          bars: input.bars,
          regimePrimary: input.regimePrimary,
          hasCatalyst: input.hasCatalyst,
          includeWalkForward: true,
        });
        if (panel.sampleSize === 0) continue;
        if (
          !best ||
          (panel.expectancyR ?? -999) > (best.expectancyR ?? -999) ||
          ((panel.expectancyR ?? 0) === (best.expectancyR ?? 0) &&
            panel.sampleSize > best.sampleSize)
        ) {
          best = panel;
        }
      } catch {
        // skip unknown
      }
    }
    return best;
  }

  listStrategyIds(): string[] {
    return listStrategies().map((s) => s.id);
  }
}
