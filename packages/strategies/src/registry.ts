import { STRATEGY_DEFINITIONS } from "./definitions.js";
import type { StrategyDefinition, StrategyFamily } from "./types.js";

const byId = new Map(STRATEGY_DEFINITIONS.map((s) => [s.id, s]));

export function listStrategies(): StrategyDefinition[] {
  return [...STRATEGY_DEFINITIONS];
}

export function getStrategy(id: string): StrategyDefinition | undefined {
  return byId.get(id);
}

export function strategiesForFamily(family: StrategyFamily): StrategyDefinition[] {
  return STRATEGY_DEFINITIONS.filter((s) => s.family === family);
}

export function assertSameLiveAndBacktestId(id: string): StrategyDefinition {
  const s = getStrategy(id);
  if (!s) throw new Error(`Unknown strategy id: ${id}`);
  return s;
}
