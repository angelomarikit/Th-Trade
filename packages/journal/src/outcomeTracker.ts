import type { Bar } from "@wulu/market-data";
import type { JournalEntry, SignalOutcome } from "./types.js";

/**
 * Update open journal outcomes from subsequent bars.
 * Only uses bars with timestamp >= decisionAt (post-decision path).
 * Labels are stored in outcome — never written back into features.
 */
export function trackOutcomeFromBars(
  entry: JournalEntry,
  bars: Bar[],
  options?: { maxHoldBars?: number; now?: Date },
): SignalOutcome {
  if (
    entry.state !== "ENTRY_ACTIVE_LONG" &&
    entry.state !== "ENTRY_ACTIVE_SHORT"
  ) {
    return {
      status: "NOT_APPLICABLE",
      exitPrice: null,
      exitAt: null,
      rMultiple: null,
      mfeR: null,
      maeR: null,
      barsHeld: null,
      exitReason: "NONE",
      labeledAt: options?.now?.toISOString() ?? new Date().toISOString(),
    };
  }

  const decisionMs = new Date(entry.decisionAt).getTime();
  const path = bars
    .filter((b) => b.completed && b.timestamp.getTime() >= decisionMs)
    .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  if (path.length === 0) {
    return {
      status: "OPEN",
      exitPrice: null,
      exitAt: null,
      rMultiple: null,
      mfeR: null,
      maeR: null,
      barsHeld: 0,
      exitReason: null,
      labeledAt: null,
    };
  }

  const entryPrice = entry.entry;
  const stop = entry.stop;
  const target = entry.target1;
  const risk = Math.abs(entryPrice - stop);
  if (risk <= 0) {
    return {
      status: "EXPIRED",
      exitPrice: path[0]!.close,
      exitAt: path[0]!.timestamp.toISOString(),
      rMultiple: 0,
      mfeR: 0,
      maeR: 0,
      barsHeld: 0,
      exitReason: "NONE",
      labeledAt: new Date().toISOString(),
    };
  }

  const isLong = entry.side === "LONG";
  const maxHold = options?.maxHoldBars ?? 24;
  let mfe = 0;
  let mae = 0;

  const slice = path.slice(0, maxHold);
  for (let i = 0; i < slice.length; i++) {
    const b = slice[i]!;
    if (isLong) {
      mfe = Math.max(mfe, (b.high - entryPrice) / risk);
      mae = Math.max(mae, (entryPrice - b.low) / risk);
      if (b.low <= stop) {
        return close(b, stop, entryPrice, risk, isLong, i + 1, mfe, mae, "STOP");
      }
      if (b.high >= target) {
        return close(b, target, entryPrice, risk, isLong, i + 1, mfe, mae, "TARGET");
      }
    } else {
      mfe = Math.max(mfe, (entryPrice - b.low) / risk);
      mae = Math.max(mae, (b.high - entryPrice) / risk);
      if (b.high >= stop) {
        return close(b, stop, entryPrice, risk, isLong, i + 1, mfe, mae, "STOP");
      }
      if (b.low <= target) {
        return close(b, target, entryPrice, risk, isLong, i + 1, mfe, mae, "TARGET");
      }
    }
  }

  if (slice.length >= maxHold) {
    const last = slice[slice.length - 1]!;
    return close(last, last.close, entryPrice, risk, isLong, slice.length, mfe, mae, "TIMEOUT");
  }

  const last = slice[slice.length - 1]!;
  const unrealized = isLong
    ? (last.close - entryPrice) / risk
    : (entryPrice - last.close) / risk;

  return {
    status: "OPEN",
    exitPrice: null,
    exitAt: null,
    rMultiple: unrealized,
    mfeR: mfe,
    maeR: mae,
    barsHeld: slice.length,
    exitReason: null,
    labeledAt: null,
  };
}

function close(
  bar: Bar,
  exitPrice: number,
  entryPrice: number,
  risk: number,
  isLong: boolean,
  barsHeld: number,
  mfe: number,
  mae: number,
  reason: SignalOutcome["exitReason"],
): SignalOutcome {
  const r = isLong ? (exitPrice - entryPrice) / risk : (entryPrice - exitPrice) / risk;
  return {
    status: "CLOSED",
    exitPrice,
    exitAt: bar.timestamp.toISOString(),
    rMultiple: r,
    mfeR: mfe,
    maeR: mae,
    barsHeld,
    exitReason: reason,
    labeledAt: new Date().toISOString(),
  };
}
