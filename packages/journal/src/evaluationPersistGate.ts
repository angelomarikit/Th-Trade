import type { LiveSetupCard } from "@wulu/confirmation";
import { deriveTradingAction } from "@wulu/confirmation";

export interface EvaluationPersistSnapshot {
  state: string;
  barAsOf: string | null;
  retestPhase: string | null;
  techniquePhase: string | null;
  strategyName: string | null;
  tradingAction: string;
}

/**
 * Record journal rows on state transitions, new completed 5m bars, retest/technique phase changes.
 */
export class EvaluationPersistGate {
  private readonly last = new Map<string, EvaluationPersistSnapshot>();

  key(card: LiveSetupCard): string {
    return `${card.symbol}:${card.side}:${card.setupId}`;
  }

  snapshot(card: LiveSetupCard): EvaluationPersistSnapshot {
    return {
      state: card.state,
      barAsOf: card.lastCompletedBar?.timestamp ?? null,
      retestPhase: card.signalIntelligence?.retest.phase ?? null,
      techniquePhase: card.activeTechnique?.phase ?? null,
      strategyName:
        card.activeTechnique?.strategyName ??
        card.matchedStrategies[0]?.strategyName ??
        null,
      tradingAction: deriveTradingAction({
        state: card.state,
        statusLabel: card.statusLabel,
        userStatus: card.statusLabel,
        dataFresh: card.dataFresh,
        entryExecutable: card.entryZone.executable,
        rewardToRisk: card.rewardToRisk,
      }),
    };
  }

  shouldRecord(card: LiveSetupCard): boolean {
    const k = this.key(card);
    const next = this.snapshot(card);
    const prev = this.last.get(k);
    this.last.set(k, next);

    if (!prev) return true;
    if (prev.state !== next.state) return true;
    if (prev.tradingAction !== next.tradingAction) return true;
    if (prev.retestPhase !== next.retestPhase) return true;
    if (prev.techniquePhase !== next.techniquePhase) return true;
    if (prev.strategyName !== next.strategyName) return true;

    const entryLike =
      card.state === "ENTRY_ACTIVE_LONG" ||
      card.state === "ENTRY_ACTIVE_SHORT" ||
      card.state === "NEAR_ACTIVE" ||
      card.state === "WAIT";
    if (entryLike && next.barAsOf && next.barAsOf !== prev.barAsOf) return true;

    return false;
  }

  reset(): void {
    this.last.clear();
  }
}
