import type { TradeSide } from "@wulu/domain";
import type { Bar } from "@wulu/market-data";
import { lastCompletedBar } from "@wulu/market-data";
import { candleAnatomy } from "./candleAnatomy.js";

export type FakeBreakoutSeverity = "LOW" | "MODERATE" | "HIGH" | "CONFIRMED_FAIL";

export interface FakeBreakoutWarning {
  pattern:
    | "BULL_TRAP"
    | "BEAR_TRAP"
    | "LONG_UPPER_WICK_REJECTION"
    | "LONG_LOWER_WICK_REJECTION"
    | "LOW_VOLUME_BREAKOUT"
    | "FAILED_RETEST"
    | "MOMENTUM_EXHAUSTION";
  sideRelevance: TradeSide;
  evidence: string;
  candleTimestamp: string | null;
  level: number | null;
  severity: FakeBreakoutSeverity;
  /** WAIT | KEEP_CONFIRMATION | INVALIDATE */
  suggestedAction: "WAIT" | "KEEP_CONFIRMATION" | "INVALIDATE";
  earlyWarning: boolean;
}

export interface FakeBreakoutInput {
  side: TradeSide;
  bars5m: Bar[];
  trigger: number;
  rvol: number | null;
  minRvol?: number;
  /** Prior bar close was beyond trigger but last closed back inside */
  retestFailed?: boolean;
}

/**
 * Rule-based false-breakout / trap risk. Early warnings ≠ confirmed failure.
 */
export function detectFakeBreakoutRisk(input: FakeBreakoutInput): FakeBreakoutWarning[] {
  const out: FakeBreakoutWarning[] = [];
  const completed = input.bars5m.filter((b) => b.completed);
  const last = lastCompletedBar(input.bars5m);
  if (!last || completed.length < 2) return out;

  const prior = completed[completed.length - 2]!;
  const anat = candleAnatomy(last);
  const minRvol = input.minRvol ?? 1.2;
  const ts = last.timestamp.toISOString();

  if (anat.upperWickRatio >= 0.45 && anat.bodyRatio <= 0.4) {
    out.push({
      pattern: "LONG_UPPER_WICK_REJECTION",
      sideRelevance: "LONG",
      evidence: `Upper wick ${(anat.upperWickRatio * 100).toFixed(0)}% of range; body only ${(anat.bodyRatio * 100).toFixed(0)}%`,
      candleTimestamp: ts,
      level: last.high,
      severity: anat.upperWickRatio >= 0.6 ? "HIGH" : "MODERATE",
      suggestedAction: "WAIT",
      earlyWarning: true,
    });
  }

  if (anat.lowerWickRatio >= 0.45 && anat.bodyRatio <= 0.4) {
    out.push({
      pattern: "LONG_LOWER_WICK_REJECTION",
      sideRelevance: "SHORT",
      evidence: `Lower wick ${(anat.lowerWickRatio * 100).toFixed(0)}% of range; body only ${(anat.bodyRatio * 100).toFixed(0)}%`,
      candleTimestamp: ts,
      level: last.low,
      severity: anat.lowerWickRatio >= 0.6 ? "HIGH" : "MODERATE",
      suggestedAction: "WAIT",
      earlyWarning: true,
    });
  }

  // Bull trap: pierced above trigger/prior high but closed back below
  if (
    last.high > input.trigger &&
    last.close < input.trigger &&
    prior.high <= input.trigger * 1.001
  ) {
    out.push({
      pattern: "BULL_TRAP",
      sideRelevance: "LONG",
      evidence: `High ${last.high.toFixed(2)} > trigger ${input.trigger.toFixed(2)} but close ${last.close.toFixed(2)} back below`,
      candleTimestamp: ts,
      level: input.trigger,
      severity: "CONFIRMED_FAIL",
      suggestedAction: input.side === "LONG" ? "INVALIDATE" : "KEEP_CONFIRMATION",
      earlyWarning: false,
    });
  }

  // Bear trap: pierced below trigger/prior low but closed back above
  if (
    last.low < input.trigger &&
    last.close > input.trigger &&
    prior.low >= input.trigger * 0.999
  ) {
    out.push({
      pattern: "BEAR_TRAP",
      sideRelevance: "SHORT",
      evidence: `Low ${last.low.toFixed(2)} < trigger ${input.trigger.toFixed(2)} but close ${last.close.toFixed(2)} reclaimed`,
      candleTimestamp: ts,
      level: input.trigger,
      severity: "CONFIRMED_FAIL",
      suggestedAction: input.side === "SHORT" ? "INVALIDATE" : "KEEP_CONFIRMATION",
      earlyWarning: false,
    });
  }

  const broke =
    input.side === "LONG"
      ? last.close > input.trigger || last.high > input.trigger
      : last.close < input.trigger || last.low < input.trigger;
  if (broke && input.rvol != null && input.rvol < minRvol) {
    out.push({
      pattern: "LOW_VOLUME_BREAKOUT",
      sideRelevance: input.side,
      evidence: `Break attempt with RVOL ${input.rvol.toFixed(2)}x < ${minRvol}x (IEX volume ≠ consolidated)`,
      candleTimestamp: ts,
      level: input.trigger,
      severity: "MODERATE",
      suggestedAction: "WAIT",
      earlyWarning: true,
    });
  }

  if (input.retestFailed) {
    out.push({
      pattern: "FAILED_RETEST",
      sideRelevance: input.side,
      evidence: "Breakout level failed to hold on retest (completed candle)",
      candleTimestamp: ts,
      level: input.trigger,
      severity: "CONFIRMED_FAIL",
      suggestedAction: "INVALIDATE",
      earlyWarning: false,
    });
  }

  // Momentum exhaustion: large range bar then weak follow-through body
  if (completed.length >= 3) {
    const prev2 = completed[completed.length - 3]!;
    const prevRange = Math.max(1e-9, prior.high - prior.low);
    const earlierRange = Math.max(1e-9, prev2.high - prev2.low);
    if (prevRange > earlierRange * 1.8 && anat.bodyRatio < 0.25) {
      out.push({
        pattern: "MOMENTUM_EXHAUSTION",
        sideRelevance: input.side,
        evidence: "Expansion bar followed by low-body candle — participation may be fading",
        candleTimestamp: ts,
        level: input.trigger,
        severity: "LOW",
        suggestedAction: "WAIT",
        earlyWarning: true,
      });
    }
  }

  return out;
}

export function worstFakeBreakoutSeverity(
  warnings: FakeBreakoutWarning[],
): FakeBreakoutSeverity | "NONE" {
  if (warnings.some((w) => w.severity === "CONFIRMED_FAIL")) return "CONFIRMED_FAIL";
  if (warnings.some((w) => w.severity === "HIGH")) return "HIGH";
  if (warnings.some((w) => w.severity === "MODERATE")) return "MODERATE";
  if (warnings.some((w) => w.severity === "LOW")) return "LOW";
  return "NONE";
}
