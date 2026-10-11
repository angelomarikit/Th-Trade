import type { SignalPerformanceRecord } from "@wulu/confirmation";
import { MemorySignalPerformanceStore } from "@wulu/confirmation";
import { getSupabaseAdmin, isSupabaseConfigured } from "../billing/supabaseAdmin.js";

export async function insertSignalPerformanceRecord(
  row: SignalPerformanceRecord,
): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  const sb = getSupabaseAdmin();
  const payload = {
    id: row.id,
    user_id: isUuid(row.userId) ? row.userId : null,
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
    live_validated: row.liveValidated,
  };
  const { error } = await sb.from("signal_performance_records").upsert(payload, {
    onConflict: "id",
  });
  if (error) {
    console.warn("[signal-history] insert:", error.message);
    return false;
  }
  return true;
}

export async function listSignalPerformanceRecords(opts: {
  userId?: string | null;
  limit?: number;
}): Promise<SignalPerformanceRecord[]> {
  if (!isSupabaseConfigured()) return [];
  const sb = getSupabaseAdmin();
  let q = sb
    .from("signal_performance_records")
    .select("*")
    .order("signal_timestamp", { ascending: false })
    .limit(Math.min(opts.limit ?? 50, 200));
  if (opts.userId && isUuid(opts.userId)) {
    q = q.eq("user_id", opts.userId);
  }
  const { data, error } = await q;
  if (error) {
    console.warn("[signal-history] list:", error.message);
    return [];
  }
  return (data ?? []).map(rowToRecord);
}

function rowToRecord(row: Record<string, unknown>): SignalPerformanceRecord {
  return {
    id: String(row.id),
    userId: (row.user_id as string | null) ?? null,
    symbol: String(row.symbol),
    side: String(row.side),
    strategyType: String(row.strategy_type ?? "SCANNER"),
    setupId: String(row.setup_id),
    signalTimestamp: String(row.signal_timestamp),
    dataTimestamp: (row.data_timestamp as string | null) ?? null,
    marketSession: (row.market_session as string | null) ?? null,
    trigger: Number(row.trigger_level ?? 0),
    entryZone: (row.entry_zone as SignalPerformanceRecord["entryZone"]) ?? {
      low: 0,
      high: 0,
      executable: false,
    },
    stop: Number(row.stop_level ?? 0),
    target1: Number(row.target1 ?? 0),
    target2: Number(row.target2 ?? 0),
    target3: row.target3 == null ? null : Number(row.target3),
    qualityScore10: row.quality_score_10 == null ? null : Number(row.quality_score_10),
    setupScore100: Number(row.setup_score_100 ?? 0),
    falseBreakoutRisk: (row.false_breakout_risk as string | null) ?? null,
    state: String(row.state),
    actionable: Boolean(row.actionable),
    dataQualityOk: Boolean(row.data_quality_ok),
    confirmationSummary: Array.isArray(row.confirmation_summary)
      ? (row.confirmation_summary as string[])
      : [],
    outcomeStatus: (row.outcome_status as SignalPerformanceRecord["outcomeStatus"]) ?? "UNKNOWN",
    outcomeR: row.outcome_r == null ? null : Number(row.outcome_r),
    source: row.source === "HISTORICAL_REPLAY" ? "HISTORICAL_REPLAY" : "LIVE",
    liveValidated: Boolean(row.live_validated),
  };
}

/** Memory + optional Supabase dual-write. Survives process restart when DB is available. */
export class HybridSignalPerformanceStore {
  private readonly memory = new MemorySignalPerformanceStore();

  record(row: SignalPerformanceRecord): void {
    this.memory.record(row);
    void insertSignalPerformanceRecord(row);
  }

  list(limit = 100): SignalPerformanceRecord[] {
    return this.memory.list(limit);
  }

  async listMerged(limit = 50, userId?: string | null): Promise<SignalPerformanceRecord[]> {
    const fromDb = await listSignalPerformanceRecords({ userId, limit });
    if (fromDb.length > 0) return fromDb;
    const mem = this.memory.list(limit);
    if (userId && isUuid(userId)) {
      return mem.filter((r) => r.userId === userId || r.userId == null);
    }
    return mem;
  }

  summary() {
    return this.memory.summary();
  }

  async summaryMerged(userId?: string | null) {
    const rows = await this.listMerged(500, userId);
    return {
      total: rows.length,
      actionable: rows.filter((r) => r.actionable).length,
      invalidated: rows.filter((r) => r.state.includes("INVALIDATED")).length,
      missed: rows.filter((r) => r.state.includes("MISSED")).length,
      liveValidated: rows.filter((r) => r.liveValidated).length,
      note: "Counts only — not a validated live win rate. liveValidated stays false until RTH operator confirmation.",
    };
  }
}

export interface UserAlertPreferences {
  userId: string;
  inAppEnabled: boolean;
  browserEnabled: boolean;
  emailEnabled: boolean;
  smsEnabled: boolean;
  pushEnabled: boolean;
  updatedAt: string;
}

const DEFAULT_PREFS = (userId: string): UserAlertPreferences => ({
  userId,
  inAppEnabled: true,
  browserEnabled: false,
  emailEnabled: false,
  smsEnabled: false,
  pushEnabled: false,
  updatedAt: new Date().toISOString(),
});

export async function getAlertPreferences(userId: string): Promise<UserAlertPreferences> {
  if (!isSupabaseConfigured() || !isUuid(userId)) return DEFAULT_PREFS(userId);
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("user_alert_preferences")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data) return DEFAULT_PREFS(userId);
  return {
    userId,
    inAppEnabled: Boolean(data.in_app_enabled),
    browserEnabled: Boolean(data.browser_enabled),
    emailEnabled: Boolean(data.email_enabled),
    smsEnabled: Boolean(data.sms_enabled),
    pushEnabled: Boolean(data.push_enabled),
    updatedAt: String(data.updated_at ?? new Date().toISOString()),
  };
}

export async function saveAlertPreferences(
  userId: string,
  patch: Partial<{
    inAppEnabled: boolean;
    browserEnabled: boolean;
    emailEnabled: boolean;
    smsEnabled: boolean;
    pushEnabled: boolean;
  }>,
): Promise<UserAlertPreferences> {
  const current = await getAlertPreferences(userId);
  const next: UserAlertPreferences = {
    ...current,
    ...patch,
    userId,
    // External channels stay off until wired — never silently enable SMS/email/push senders.
    emailEnabled: false,
    smsEnabled: false,
    pushEnabled: false,
    updatedAt: new Date().toISOString(),
  };
  if (!isSupabaseConfigured() || !isUuid(userId)) return next;
  const sb = getSupabaseAdmin();
  const { error } = await sb.from("user_alert_preferences").upsert(
    {
      user_id: userId,
      in_app_enabled: next.inAppEnabled,
      browser_enabled: next.browserEnabled,
      email_enabled: next.emailEnabled,
      sms_enabled: next.smsEnabled,
      push_enabled: next.pushEnabled,
      updated_at: next.updatedAt,
    },
    { onConflict: "user_id" },
  );
  if (error) console.warn("[alert-prefs] upsert:", error.message);
  return next;
}

/**
 * Mark delivery plan for a recorded alert. Does not send SMS/email/push.
 * Channels: in_app always when enabled; browser_pending when browser_enabled.
 */
export async function planAlertDelivery(
  userId: string,
  eventId: string,
): Promise<{ status: string; channels: string[] }> {
  const prefs = await getAlertPreferences(userId);
  const channels: string[] = [];
  if (prefs.inAppEnabled) channels.push("in_app");
  if (prefs.browserEnabled) channels.push("browser_pending");
  const status = channels.length ? "recorded_for_delivery" : "recorded";
  if (!isSupabaseConfigured() || !isUuid(userId)) {
    return { status, channels };
  }
  const sb = getSupabaseAdmin();
  const { error } = await sb
    .from("monitor_alert_events")
    .update({
      delivery_status: status,
      delivery_channels: channels,
    })
    .eq("id", eventId)
    .eq("user_id", userId);
  if (error) console.warn("[alert-delivery] update:", error.message);
  return { status, channels };
}

function isUuid(v: string | null | undefined): boolean {
  if (!v) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}
