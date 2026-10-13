/**
 * Server-side evidence checks for liveValidated.
 * Verified signal outcomes are not customer trading P/L (WULU does not execute orders).
 */

import type { TradeSide } from "@wulu/domain";
import { resolveOutcomeOnBar, type BarExtremes } from "./outcomeTracking.js";
import type { SignalPerformanceRecord } from "./signalPerformance.js";

export interface ValidationEvidenceSnapshot {
  symbol: string;
  side: string;
  signalTimestamp: string;
  dataTimestamp: string | null;
  marketSession: string | null;
  trigger: number;
  entryZone: { low: number; high: number; executable: boolean };
  entryMid: number;
  stop: number;
  target1: number;
  target2: number;
  target3: number | null;
  rewardToRiskT1: number;
  recordedOutcomeStatus: string;
  recordedOutcomeR: number | null;
  state: string;
  actionable: boolean;
  dataQualityOk: boolean;
  source: string;
  /** Bars used to re-verify path (high/low/close/ts). */
  verifyingBars: BarExtremes[];
  recomputedDetail: string | null;
  recomputedOutcomeStatus: string | null;
  recomputedOutcomeR: number | null;
  recomputedResolvedAt: string | null;
  checks: Array<{ id: string; ok: boolean; detail: string }>;
  disclaimer: string;
  automaticOrders: false;
}

export interface EvidenceCheckResult {
  ok: boolean;
  errors: string[];
  evidence: ValidationEvidenceSnapshot;
}

const DISCLAIMER =
  "Verified signal outcomes describe scanner level paths on market data — not executed customer trades, fills, or account profits. WULU automatic orders remain disabled.";

const RESOLVED_OK = new Set(["WIN", "LOSS"]);

function entryMid(zone: { low: number; high: number }): number {
  return (zone.low + zone.high) / 2;
}

function rewardToRiskT1(entry: number, stop: number, t1: number): number {
  const risk = Math.abs(entry - stop);
  if (!(risk > 0)) return 0;
  return Math.abs(t1 - entry) / risk;
}

/**
 * Build evidence + verify geometry, entry requirements, and that bars support the recorded outcome.
 * Incomplete evidence → ok=false (remain unvalidated).
 */
export function verifyLiveValidationEvidence(
  row: SignalPerformanceRecord,
  bars: BarExtremes[],
): EvidenceCheckResult {
  const errors: string[] = [];
  const checks: ValidationEvidenceSnapshot["checks"] = [];
  const mid = entryMid(row.entryZone);
  const rr = rewardToRiskT1(mid, row.stop, row.target1);
  const side = (row.side === "SHORT" ? "SHORT" : "LONG") as TradeSide;

  const push = (id: string, ok: boolean, detail: string) => {
    checks.push({ id, ok, detail });
    if (!ok) errors.push(`${id}: ${detail}`);
  };

  push(
    "source_live",
    row.source === "LIVE",
    row.source === "LIVE" ? "source=LIVE" : `source=${row.source} (REPLAY not allowed)`,
  );

  push(
    "levels_present",
    Number.isFinite(row.entryZone.low) &&
      Number.isFinite(row.entryZone.high) &&
      row.entryZone.high > row.entryZone.low &&
      Number.isFinite(row.stop) &&
      row.stop > 0 &&
      Number.isFinite(row.target1) &&
      row.target1 > 0 &&
      Number.isFinite(row.trigger),
    `entry ${row.entryZone.low}-${row.entryZone.high} stop=${row.stop} t1=${row.target1} trigger=${row.trigger}`,
  );

  push(
    "timestamps_present",
    Boolean(row.signalTimestamp) && !Number.isNaN(Date.parse(row.signalTimestamp)),
    `signalTimestamp=${row.signalTimestamp} dataTimestamp=${row.dataTimestamp ?? "null"}`,
  );

  push(
    "geometry_long_short",
    side === "LONG"
      ? row.stop < mid && row.target1 > mid
      : row.stop > mid && row.target1 < mid,
    side === "LONG"
      ? "LONG: stop below entry, T1 above"
      : "SHORT: stop above entry, T1 below",
  );

  push(
    "min_2r_to_t1",
    rr >= 1.95,
    `rewardToRiskT1=${rr.toFixed(3)} (require ≥ ~2R)`,
  );

  push(
    "entry_requirements",
    row.actionable === true ||
      row.state === "ENTRY_ACTIVE_LONG" ||
      row.state === "ENTRY_ACTIVE_SHORT",
    `actionable=${row.actionable} state=${row.state} dataQualityOk=${row.dataQualityOk}`,
  );

  push(
    "data_quality",
    row.dataQualityOk === true,
    row.dataQualityOk ? "data quality ok at signal time" : "data quality not ok — fail closed",
  );

  const outcome = String(row.outcomeStatus ?? "UNKNOWN").toUpperCase();
  push(
    "outcome_resolved",
    RESOLVED_OK.has(outcome) && row.outcomeR != null && Number.isFinite(row.outcomeR),
    `outcomeStatus=${outcome} outcomeR=${row.outcomeR}`,
  );

  // Bars after signal time for path verification
  const signalMs = Date.parse(row.signalTimestamp);
  const after = bars
    .filter((b) => {
      const t = Date.parse(b.timestamp);
      return Number.isFinite(t) && (!Number.isFinite(signalMs) || t >= signalMs - 5 * 60_000);
    })
    .slice(0, 120);

  push(
    "market_bars",
    after.length >= 1,
    after.length >= 1
      ? `${after.length} bar(s) available for path check`
      : "No market bars covering signal window — cannot verify outcome",
  );

  let recomputedDetail: string | null = null;
  let recomputedOutcomeStatus: string | null = null;
  let recomputedOutcomeR: number | null = null;
  let recomputedResolvedAt: string | null = null;

  if (after.length > 0 && Number.isFinite(mid) && mid > 0) {
    for (const bar of after) {
      const hit = resolveOutcomeOnBar({
        side,
        entryPrice: mid,
        stop: row.stop,
        target1: row.target1,
        target2: row.target2,
        target3: row.target3,
        bar,
      });
      if (hit) {
        recomputedDetail = hit.detail;
        recomputedOutcomeStatus = hit.outcomeStatus;
        recomputedOutcomeR = hit.outcomeR;
        recomputedResolvedAt = bar.timestamp;
        break;
      }
    }
  }

  const pathOk =
    recomputedOutcomeStatus != null &&
    RESOLVED_OK.has(String(recomputedOutcomeStatus).toUpperCase()) &&
    String(recomputedOutcomeStatus).toUpperCase() === outcome &&
    recomputedOutcomeR != null &&
    row.outcomeR != null &&
    Math.abs(recomputedOutcomeR - row.outcomeR) <= 0.35;

  push(
    "outcome_path_verified",
    pathOk,
    pathOk
      ? `bars confirm ${recomputedDetail} → ${recomputedOutcomeStatus} R≈${recomputedOutcomeR?.toFixed(2)}`
      : `recomputed=${recomputedOutcomeStatus ?? "none"}/${recomputedDetail ?? "—"} R=${recomputedOutcomeR} vs recorded ${outcome}/${row.outcomeR}`,
  );

  // Ambiguous bar paths cannot be live-validated
  if (recomputedOutcomeStatus === "AMBIGUOUS") {
    push("no_ambiguous", false, "Intrabar stop+target ambiguity — leave unvalidated");
  } else {
    push("no_ambiguous", true, "Path not marked ambiguous");
  }

  const evidence: ValidationEvidenceSnapshot = {
    symbol: row.symbol,
    side: row.side,
    signalTimestamp: row.signalTimestamp,
    dataTimestamp: row.dataTimestamp,
    marketSession: row.marketSession,
    trigger: row.trigger,
    entryZone: row.entryZone,
    entryMid: mid,
    stop: row.stop,
    target1: row.target1,
    target2: row.target2,
    target3: row.target3,
    rewardToRiskT1: rr,
    recordedOutcomeStatus: outcome,
    recordedOutcomeR: row.outcomeR,
    state: row.state,
    actionable: row.actionable,
    dataQualityOk: row.dataQualityOk,
    source: row.source,
    verifyingBars: after.slice(0, 40),
    recomputedDetail,
    recomputedOutcomeStatus,
    recomputedOutcomeR,
    recomputedResolvedAt,
    checks,
    disclaimer: DISCLAIMER,
    automaticOrders: false,
  };

  return {
    ok: errors.length === 0,
    errors,
    evidence,
  };
}
