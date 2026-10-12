import type { LiveSetupCard } from "./liveCard.js";

/**
 * Gate live history writes so monitor ticks do not flood Supabase.
 * Persist when: state changes, completed 5m bar advances while WAIT/NEAR/ENTRY,
 * or caller forces (open track / resolution).
 */
export class SignalPersistGate {
  private readonly last = new Map<
    string,
    { state: string; barAsOf: string | null }
  >();

  key(userId: string | null | undefined, setupId: string): string {
    return `${userId ?? "anon"}::${setupId}`;
  }

  /** Returns true when this card should be written to durable history. */
  shouldPersist(card: LiveSetupCard, userId: string | null | undefined): boolean {
    const k = this.key(userId, card.setupId);
    const barAsOf = card.lastCompletedBar?.timestamp ?? null;
    const prev = this.last.get(k);
    this.last.set(k, { state: card.state, barAsOf });

    if (!prev) return true;
    if (prev.state !== card.state) return true;

    const entryLike =
      card.state === "ENTRY_ACTIVE_LONG" ||
      card.state === "ENTRY_ACTIVE_SHORT" ||
      card.state === "NEAR_ACTIVE" ||
      card.state === "WAIT";
    if (entryLike && barAsOf && barAsOf !== prev.barAsOf) return true;

    return false;
  }

  /** Test helper — clear remembered keys. */
  reset(): void {
    this.last.clear();
  }
}
