import type { TradeSide } from "@wulu/domain";
import type { Bar, MarketSnapshot } from "@wulu/market-data";
import { evaluateSetup, type EvaluateSetupInput } from "./evaluateSetup.js";
import type { LiveSetupCard } from "./liveCard.js";
import {
  outcomeTags,
  SignalOutcomeTracker,
  type OpenTrackedSignal,
  type OutcomeResolution,
} from "./outcomeTracking.js";
import type { RetestPhase } from "./retest.js";
import { cardToPerformanceRecord, type SignalPerformanceRecord } from "./signalPerformance.js";

export interface ReplayStepResult {
  barIndex: number;
  asOf: string;
  label: "HISTORICAL REPLAY — NOT LIVE";
  card: LiveSetupCard;
}

export interface SignalReplayResult {
  symbol: string;
  side: TradeSide;
  label: "HISTORICAL REPLAY — NOT LIVE";
  steps: ReplayStepResult[];
  transitions: Array<{
    from: string;
    to: string;
    at: string;
    barIndex: number;
  }>;
  outcomes: OutcomeResolution[];
  /** Still-open tracked entries at end of replay (not yet stop/target). */
  openTracks: OpenTrackedSignal[];
  disclaimer: string;
}

/**
 * Chronological replay: at each completed bar i, only bars[0..i] (+ optional forming stub)
 * are visible — no look-ahead into future candles.
 */
export function runSignalReplay(input: {
  symbol: string;
  side: TradeSide;
  bars5m: Bar[];
  bars1m?: Bar[];
  whyMoving?: EvaluateSetupInput["whyMoving"];
}): SignalReplayResult {
  const why =
    input.whyMoving ??
    ({
      whyMoving: "HISTORICAL REPLAY — no live catalyst",
      catalystLabel: null,
      newsAgeMinutes: null,
      priceReaction: null,
      hasVerifiedCatalyst: false,
    } as const);

  const steps: ReplayStepResult[] = [];
  const transitions: SignalReplayResult["transitions"] = [];
  const outcomes: OutcomeResolution[] = [];
  const tracker = new SignalOutcomeTracker();
  let prevState: LiveSetupCard["state"] | undefined;
  let prevRetest: RetestPhase | undefined;

  const completedIdx: number[] = [];
  for (let i = 0; i < input.bars5m.length; i++) {
    if (input.bars5m[i]?.completed) completedIdx.push(i);
  }

  for (const i of completedIdx) {
    const visible5 = input.bars5m.slice(0, i + 1).map((b, idx) => ({
      ...b,
      completed: idx < i ? b.completed : true,
    }));
    // Force last visible bar completed for evaluation at close of i
    const last = visible5[visible5.length - 1];
    if (last) visible5[visible5.length - 1] = { ...last, completed: true };

    const lastBar = visible5[visible5.length - 1]!;
    const snapshot: MarketSnapshot = {
      symbol: input.symbol.toUpperCase(),
      lastPrice: lastBar.close,
      quote: null,
      bars1m: (input.bars1m ?? visible5).slice(0, i + 1),
      bars5m: visible5,
      bars15m: [],
      bars1h: [],
      receivedAt: lastBar.timestamp,
      marketTimestamp: lastBar.timestamp,
    };

    const card = evaluateSetup({
      symbol: input.symbol,
      side: input.side,
      snapshot,
      whyMoving: why,
      previousState: prevState,
      previousRetestPhase: prevRetest,
      now: lastBar.timestamp,
    });

    if (prevState && prevState !== card.state) {
      transitions.push({
        from: prevState,
        to: card.state,
        at: lastBar.timestamp.toISOString(),
        barIndex: i,
      });
    }
    prevState = card.state;
    prevRetest = card.signalIntelligence?.retest.phase;

    steps.push({
      barIndex: i,
      asOf: lastBar.timestamp.toISOString(),
      label: "HISTORICAL REPLAY — NOT LIVE",
      card,
    });

    const track = tracker.onCard(card, null, "HISTORICAL_REPLAY", card.lastCompletedBar);
    if (track.resolution) outcomes.push(track.resolution);
  }

  return {
    symbol: input.symbol.toUpperCase(),
    side: input.side,
    label: "HISTORICAL REPLAY — NOT LIVE",
    steps,
    transitions,
    outcomes,
    openTracks: tracker.listOpen(),
    disclaimer:
      "Replay uses completed 5m OHLCV only. No invented ticks. Stops/targets inside the same bar are ambiguous. Hypothetical outcomes are NOT a live win rate. IEX ≠ consolidated volume. NOT LIVE.",
  };
}

/** Build a durable performance row from an outcome resolution (replay / live). */
export function resolutionToPerformanceRecord(
  resolution: OutcomeResolution,
  card: LiveSetupCard,
  source: "LIVE" | "HISTORICAL_REPLAY",
  userId: string | null,
): SignalPerformanceRecord {
  const base = cardToPerformanceRecord(card, source, userId);
  return {
    ...base,
    id: resolution.id,
    signalTimestamp: card.evaluatedAt,
    actionable: true,
    outcomeStatus: resolution.outcomeStatus,
    outcomeR: resolution.outcomeR,
    confirmationSummary: [...outcomeTags(resolution), ...base.confirmationSummary].slice(0, 16),
    liveValidated: false,
  };
}
