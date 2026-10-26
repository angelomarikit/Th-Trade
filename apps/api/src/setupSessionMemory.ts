import type { LiveSetupCard } from "@wulu/confirmation";
import type { RetestPhase } from "@wulu/confirmation";
import type { SetupState } from "@wulu/domain";

export interface SetupSessionMemory {
  state: SetupState;
  retestPhase?: RetestPhase;
  retestLevel?: number;
}

const RETEST_LEVEL_DRIFT_PCT = 0.005;

export function memoryForScan(
  mem: SetupSessionMemory | undefined,
  triggerLevel: number,
): { previousState?: SetupState; previousRetestPhase?: RetestPhase; previousRetestLevel?: number } {
  if (!mem) return {};
  let previousRetestPhase = mem.retestPhase;
  if (
    previousRetestPhase &&
    previousRetestPhase !== "NONE" &&
    mem.retestLevel != null &&
    triggerLevel > 0 &&
    Math.abs(triggerLevel - mem.retestLevel) / mem.retestLevel > RETEST_LEVEL_DRIFT_PCT
  ) {
    previousRetestPhase = undefined;
  }
  return {
    previousState: mem.state,
    previousRetestPhase,
    previousRetestLevel: mem.retestLevel,
  };
}

export function writeSetupSessionMemory(
  map: Map<string, SetupSessionMemory>,
  key: string,
  card: LiveSetupCard,
): void {
  map.set(key, {
    state: card.state,
    retestPhase: card.signalIntelligence?.retest.phase,
    retestLevel: card.alertAt,
  });
}
