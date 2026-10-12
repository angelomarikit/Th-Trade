/**
 * Phase 4: prove WAIT → ENTRY ACTIVE → HIT_T1 persistence in Supabase
 * (labeled HISTORICAL_REPLAY — not live). Uses outcome tracker + performance upserts.
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  SignalOutcomeTracker,
  cardToPerformanceRecord,
  resolutionToPerformanceRecord,
} from "@wulu/confirmation";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
config({ path: path.join(root, ".env") });

const sb = createClient(
  process.env.SUPABASE_URL.trim(),
  process.env.SUPABASE_SERVICE_ROLE_KEY.trim(),
  { auth: { persistSession: false } },
);

function card(partial) {
  return {
    symbol: "REPLAY",
    side: "LONG",
    statusLabel: partial.state,
    alertAt: 100,
    entryZone: { low: 100, high: 100.5, executable: true },
    stop: 99,
    target1: 102,
    target2: 104,
    target3: 106,
    lastPrice: 100.2,
    dataFresh: true,
    evaluatedAt: "2026-10-12T14:00:00.000Z",
    setupId: "REPLAY:LONG:100.0000",
    setupScore: { total: 70 },
    qualityScore10: { score: 7 },
    signalIntelligence: { entryModel: "SCANNER", falseBreakoutRisk: "NONE" },
    session: { session: "RTH" },
    nearActive: { stillWaitingFor: ["Waiting for confirmation"], dataTimestamp: null },
    rewardToRisk: 2,
    ...partial,
  };
}

async function upsert(row) {
  const payload = {
    id: row.id,
    user_id: null,
    symbol: row.symbol,
    side: row.side,
    strategy_type: row.strategyType,
    setup_id: row.setupId,
    signal_timestamp: row.signalTimestamp,
    data_timestamp: row.dataTimestamp,
    market_session: row.marketSession,
    trigger_level: row.trigger,
    entry_zone: row.entryZone,
    stop_level: row.stop,
    target1: row.target1,
    target2: row.target2,
    target3: row.target3,
    quality_score_10: row.qualityScore10,
    setup_score_100: row.setupScore100,
    false_breakout_risk: row.falseBreakoutRisk,
    state: row.state,
    actionable: row.actionable,
    data_quality_ok: row.dataQualityOk,
    confirmation_summary: row.confirmationSummary,
    outcome_status: row.outcomeStatus,
    outcome_r: row.outcomeR,
    source: row.source,
    live_validated: false,
  };
  const { error } = await sb.from("signal_performance_records").upsert(payload, {
    onConflict: "id",
  });
  if (error) throw new Error(error.message);
}

const tracker = new SignalOutcomeTracker();

const waitCard = card({
  state: "WAIT",
  lastPrice: 99.5,
  entryZone: { low: 100, high: 100.5, executable: false },
  evaluatedAt: "2026-10-12T13:55:00.000Z",
  lastCompletedBar: { high: 99.6, low: 99.2, close: 99.5, timestamp: "2026-10-12T13:55:00.000Z" },
});
await upsert(cardToPerformanceRecord(waitCard, "HISTORICAL_REPLAY", null));
console.log("1 WAIT recorded");

const entryCard = card({
  state: "ENTRY_ACTIVE_LONG",
  lastPrice: 100.2,
  evaluatedAt: "2026-10-12T14:00:00.000Z",
  lastCompletedBar: { high: 100.4, low: 100, close: 100.2, timestamp: "2026-10-12T14:00:00.000Z" },
});
const opened = tracker.onCard(entryCard, null, "HISTORICAL_REPLAY", entryCard.lastCompletedBar);
if (!opened.opened) throw new Error("expected open track on ENTRY ACTIVE");
await upsert(cardToPerformanceRecord(entryCard, "HISTORICAL_REPLAY", null));
await upsert({
  ...cardToPerformanceRecord(entryCard, "HISTORICAL_REPLAY", null),
  id: opened.opened.id,
  actionable: true,
  confirmationSummary: [
    "outcomeDetail:OPEN",
    `entryPrice:${opened.opened.entryPrice}`,
    `stop:${opened.opened.stop}`,
    `target1:${opened.opened.target1}`,
    `target2:${opened.opened.target2}`,
    `source:HISTORICAL_REPLAY`,
    `setupId:${opened.opened.setupId}`,
    `barsElapsed:0`,
  ],
});
console.log("2 ENTRY ACTIVE + open track", opened.opened.id);

const hitCard = card({
  state: "ENTRY_ACTIVE_LONG",
  lastPrice: 102.1,
  evaluatedAt: "2026-10-12T14:10:00.000Z",
  lastCompletedBar: { high: 102.3, low: 100.5, close: 102.1, timestamp: "2026-10-12T14:10:00.000Z" },
});
const resolved = tracker.onCard(hitCard, null, "HISTORICAL_REPLAY", hitCard.lastCompletedBar);
if (!resolved.resolution) throw new Error("expected HIT_T1 resolution");
await upsert(resolutionToPerformanceRecord(resolved.resolution, hitCard, "HISTORICAL_REPLAY", null));
console.log("3 resolved", resolved.resolution.detail, resolved.resolution.outcomeStatus, "R=", resolved.resolution.outcomeR);

const { data: rows, error } = await sb
  .from("signal_performance_records")
  .select("id,state,outcome_status,outcome_r,source")
  .or(`id.eq.${opened.opened.id},setup_id.eq.REPLAY:LONG:100.0000`)
  .order("signal_timestamp", { ascending: true });
if (error) throw new Error(error.message);
console.log("persisted rows:", rows?.length);
for (const r of rows ?? []) console.log(" ", r.id.slice(0, 72), r.state, r.outcome_status, r.outcome_r, r.source);

if (!rows?.some((r) => r.outcome_status === "WIN")) {
  throw new Error("WIN outcome not found in Supabase");
}
console.log("OK — full lifecycle saved as HISTORICAL_REPLAY");
