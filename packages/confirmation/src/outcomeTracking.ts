import type { TradeSide } from "@wulu/domain";
import type { LiveSetupCard } from "./liveCard.js";
import type { SignalPerformanceRecord } from "./signalPerformance.js";

export type OutcomeDetail =
  | "OPEN"
  | "HIT_T1"
  | "HIT_T2"
  | "HIT_T3"
  | "HIT_STOP"
  | "INVALIDATED"
  | "EXPIRED"
  | "AMBIGUOUS_STOP_AND_TARGET";

export interface BarExtremes {
  high: number;
  low: number;
  close: number;
  timestamp: string;
}

export interface OpenTrackedSignal {
  id: string;
  userId: string | null;
  symbol: string;
  side: TradeSide;
  setupId: string;
  entryPrice: number;
  entryAt: string;
  stop: number;
  target1: number;
  target2: number;
  target3: number | null;
  source: "LIVE" | "HISTORICAL_REPLAY";
  barsElapsed: number;
  qualityScore10: number | null;
  strategyType: string;
}

export interface OutcomeResolution {
  id: string;
  detail: OutcomeDetail;
  outcomeStatus: SignalPerformanceRecord["outcomeStatus"];
  outcomeR: number | null;
  resolvedAt: string;
  durationMs: number;
  barsElapsed: number;
  entryPrice: number;
  note: string;
}

/**
 * Resolve stop/targets on a completed bar.
 * Same-bar stop+target → AMBIGUOUS (conservative; 5m bars are not ticks).
 * If only one side is hit, prefer that outcome. Stop checked before targets when both clear? No —
 * ambiguity first; otherwise stop takes priority (capital preservation).
 */
export function resolveOutcomeOnBar(input: {
  side: TradeSide;
  entryPrice: number;
  stop: number;
  target1: number;
  target2: number;
  target3?: number | null;
  bar: BarExtremes;
}): { detail: OutcomeDetail; outcomeStatus: SignalPerformanceRecord["outcomeStatus"]; outcomeR: number | null; note: string } | null {
  const { side, entryPrice, stop, target1, target2, target3, bar } = input;
  const risk = Math.abs(entryPrice - stop);
  if (!(risk > 0) || !Number.isFinite(risk)) {
    return {
      detail: "EXPIRED",
      outcomeStatus: "AMBIGUOUS",
      outcomeR: null,
      note: "Invalid risk geometry — cannot score R",
    };
  }

  let stopHit = false;
  let t1Hit = false;
  let t2Hit = false;
  let t3Hit = false;

  if (side === "LONG") {
    stopHit = bar.low <= stop;
    t1Hit = bar.high >= target1;
    t2Hit = bar.high >= target2;
    t3Hit = target3 != null && bar.high >= target3;
  } else {
    stopHit = bar.high >= stop;
    t1Hit = bar.low <= target1;
    t2Hit = bar.low <= target2;
    t3Hit = target3 != null && bar.low <= target3;
  }

  const anyTarget = t1Hit || t2Hit || t3Hit;
  if (stopHit && anyTarget) {
    return {
      detail: "AMBIGUOUS_STOP_AND_TARGET",
      outcomeStatus: "AMBIGUOUS",
      outcomeR: null,
      note: "Stop and target both inside same 5m bar — intrabar path unknown; marked ambiguous",
    };
  }
  if (stopHit) {
    return {
      detail: "HIT_STOP",
      outcomeStatus: "LOSS",
      outcomeR: -1,
      note: "Stop level traded through on completed bar (hypothetical)",
    };
  }
  if (t3Hit && target3 != null) {
    return {
      detail: "HIT_T3",
      outcomeStatus: "WIN",
      outcomeR: Math.abs(target3 - entryPrice) / risk,
      note: "Target 3 reached on completed bar (hypothetical)",
    };
  }
  if (t2Hit) {
    return {
      detail: "HIT_T2",
      outcomeStatus: "WIN",
      outcomeR: Math.abs(target2 - entryPrice) / risk,
      note: "Target 2 reached on completed bar (hypothetical)",
    };
  }
  if (t1Hit) {
    return {
      detail: "HIT_T1",
      outcomeStatus: "WIN",
      outcomeR: Math.abs(target1 - entryPrice) / risk,
      note: "Target 1 reached on completed bar (hypothetical)",
    };
  }
  return null;
}

export function trackingId(
  setupId: string,
  userId: string | null,
  source: "LIVE" | "HISTORICAL_REPLAY",
): string {
  return `track:${source}:${userId ?? "anon"}:${setupId}`;
}

export function isEntryActiveCard(card: LiveSetupCard): boolean {
  return (
    (card.state === "ENTRY_ACTIVE_LONG" || card.state === "ENTRY_ACTIVE_SHORT") &&
    card.dataFresh &&
    card.entryZone.executable
  );
}

/** In-memory open-signal tracker; resolutions should be dual-written by the caller. */
export class SignalOutcomeTracker {
  private readonly open = new Map<string, OpenTrackedSignal>();

  listOpen(): OpenTrackedSignal[] {
    return [...this.open.values()];
  }

  /** Restore durable OPEN tracks after process restart. */
  hydrate(tracks: OpenTrackedSignal[]): number {
    let n = 0;
    for (const t of tracks) {
      if (!t?.id || this.open.has(t.id)) continue;
      this.open.set(t.id, { ...t });
      n += 1;
    }
    return n;
  }

  /**
   * Process a card + completed bar extremes.
   * Opens a track on first actionable ENTRY ACTIVE; resolves on later bars.
   */
  onCard(
    card: LiveSetupCard,
    userId: string | null,
    source: "LIVE" | "HISTORICAL_REPLAY",
    bar: BarExtremes | null,
  ): { opened?: OpenTrackedSignal; resolution?: OutcomeResolution } {
    const id = trackingId(card.setupId, userId, source);
    const existing = this.open.get(id);

    if (!existing && isEntryActiveCard(card)) {
      const entryPrice =
        card.lastPrice >= card.entryZone.low && card.lastPrice <= card.entryZone.high
          ? card.lastPrice
          : (card.entryZone.low + card.entryZone.high) / 2;
      const opened: OpenTrackedSignal = {
        id,
        userId,
        symbol: card.symbol,
        side: card.side,
        setupId: card.setupId,
        entryPrice,
        entryAt: card.evaluatedAt,
        stop: card.stop,
        target1: card.target1,
        target2: card.target2,
        target3: card.target3 ?? null,
        source,
        barsElapsed: 0,
        qualityScore10: card.qualityScore10?.score ?? null,
        strategyType: card.signalIntelligence?.entryModel ?? "SCANNER",
      };
      this.open.set(id, opened);
      return { opened };
    }

    if (!existing || !bar) {
      if (existing && (card.state === "INVALIDATED" || card.statusLabel.includes("INVALIDATED"))) {
        const resolvedAt = bar?.timestamp ?? card.evaluatedAt;
        const resolution: OutcomeResolution = {
          id: existing.id,
          detail: "INVALIDATED",
          outcomeStatus: "INVALIDATED",
          outcomeR: null,
          resolvedAt,
          durationMs: Math.max(0, Date.parse(resolvedAt) - Date.parse(existing.entryAt)),
          barsElapsed: existing.barsElapsed,
          entryPrice: existing.entryPrice,
          note: "Setup invalidated before stop/target resolution",
        };
        this.open.delete(id);
        return { resolution };
      }
      return {};
    }

    existing.barsElapsed += 1;
    const hit = resolveOutcomeOnBar({
      side: existing.side,
      entryPrice: existing.entryPrice,
      stop: existing.stop,
      target1: existing.target1,
      target2: existing.target2,
      target3: existing.target3,
      bar,
    });
    if (!hit) return {};

    const resolution: OutcomeResolution = {
      id: existing.id,
      detail: hit.detail,
      outcomeStatus: hit.outcomeStatus,
      outcomeR: hit.outcomeR,
      resolvedAt: bar.timestamp,
      durationMs: Math.max(0, Date.parse(bar.timestamp) - Date.parse(existing.entryAt)),
      barsElapsed: existing.barsElapsed,
      entryPrice: existing.entryPrice,
      note: hit.note,
    };
    this.open.delete(id);
    return { resolution };
  }
}

export function outcomeTags(resolution: OutcomeResolution): string[] {
  return [
    `outcomeDetail:${resolution.detail}`,
    `entryPrice:${resolution.entryPrice}`,
    `resolvedAt:${resolution.resolvedAt}`,
    `durationMs:${resolution.durationMs}`,
    `barsElapsed:${resolution.barsElapsed}`,
    `outcomeNote:${resolution.note}`,
  ];
}

export function parseOutcomeTags(summary: string[]): {
  outcomeDetail: OutcomeDetail | null;
  entryPrice: number | null;
  resolvedAt: string | null;
  durationMs: number | null;
  barsElapsed: number | null;
} {
  const get = (prefix: string) => {
    const row = summary.find((s) => s.startsWith(prefix));
    return row ? row.slice(prefix.length) : null;
  };
  const detail = get("outcomeDetail:");
  return {
    outcomeDetail: (detail as OutcomeDetail | null) ?? null,
    entryPrice: numOrNull(get("entryPrice:")),
    resolvedAt: get("resolvedAt:"),
    durationMs: numOrNull(get("durationMs:")),
    barsElapsed: numOrNull(get("barsElapsed:")),
  };
}

function numOrNull(v: string | null): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
