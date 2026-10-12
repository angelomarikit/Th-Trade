import type { OpenTrackedSignal } from "@wulu/confirmation";
import { getSupabaseAdmin, isSupabaseConfigured } from "../billing/supabaseAdmin.js";

function isUuid(v: string | null | undefined): boolean {
  if (!v) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

export async function upsertOpenTrack(track: OpenTrackedSignal): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  const sb = getSupabaseAdmin();
  const { error } = await sb.from("open_signal_tracks").upsert(
    {
      id: track.id,
      user_id: isUuid(track.userId) ? track.userId : null,
      symbol: track.symbol,
      side: track.side,
      setup_id: track.setupId,
      entry_price: track.entryPrice,
      entry_at: track.entryAt,
      stop_level: track.stop,
      target1: track.target1,
      target2: track.target2,
      target3: track.target3,
      source: track.source,
      bars_elapsed: track.barsElapsed,
      quality_score_10: track.qualityScore10,
      strategy_type: track.strategyType,
      status: "OPEN",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );
  if (error) {
    console.warn("[open-tracks] upsert:", error.message);
    return false;
  }
  return true;
}

export async function closeOpenTrack(id: string): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const sb = getSupabaseAdmin();
  const { error } = await sb
    .from("open_signal_tracks")
    .update({ status: "RESOLVED", updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) console.warn("[open-tracks] close:", error.message);
}

export async function loadOpenTracks(): Promise<OpenTrackedSignal[]> {
  if (!isSupabaseConfigured()) return [];
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("open_signal_tracks")
    .select("*")
    .eq("status", "OPEN")
    .order("updated_at", { ascending: false })
    .limit(500);
  if (error) {
    console.warn("[open-tracks] load:", error.message);
    return [];
  }
  return (data ?? []).map((row) => ({
    id: String(row.id),
    userId: (row.user_id as string | null) ?? null,
    symbol: String(row.symbol),
    side: row.side === "SHORT" ? "SHORT" : "LONG",
    setupId: String(row.setup_id),
    entryPrice: Number(row.entry_price),
    entryAt: String(row.entry_at),
    stop: Number(row.stop_level),
    target1: Number(row.target1),
    target2: Number(row.target2),
    target3: row.target3 == null ? null : Number(row.target3),
    source: row.source === "HISTORICAL_REPLAY" ? "HISTORICAL_REPLAY" : "LIVE",
    barsElapsed: Number(row.bars_elapsed ?? 0),
    qualityScore10: row.quality_score_10 == null ? null : Number(row.quality_score_10),
    strategyType: String(row.strategy_type ?? "SCANNER"),
  }));
}

export async function recordAlertDedupeKey(
  dedupeKey: string,
  userId: string,
  eventId: string,
): Promise<boolean> {
  if (!isSupabaseConfigured()) return true;
  const sb = getSupabaseAdmin();
  // Insert-only: existing key means this alert was already delivered/recorded.
  const { error } = await sb.from("monitor_alert_dedupe").insert({
    dedupe_key: dedupeKey,
    user_id: isUuid(userId) ? userId : null,
    event_id: eventId,
    seen_at: new Date().toISOString(),
  });
  if (error) {
    if (error.code === "23505" || error.message.toLowerCase().includes("duplicate")) {
      return false;
    }
    console.warn("[alert-dedupe] insert:", error.message);
    return true; // fail-open to memory + events unique constraint
  }
  return true;
}

export async function loadRecentAlertDedupeKeys(limit = 2_000): Promise<string[]> {
  if (!isSupabaseConfigured()) return [];
  const sb = getSupabaseAdmin();
  const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  const { data, error } = await sb
    .from("monitor_alert_dedupe")
    .select("dedupe_key")
    .gte("seen_at", since)
    .order("seen_at", { ascending: false })
    .limit(limit);
  if (error) {
    // Fallback: unique keys already on monitor_alert_events
    const { data: ev, error: e2 } = await sb
      .from("monitor_alert_events")
      .select("dedupe_key")
      .gte("event_at", since)
      .order("event_at", { ascending: false })
      .limit(limit);
    if (e2) {
      console.warn("[alert-dedupe] load:", error.message);
      return [];
    }
    return [...new Set((ev ?? []).map((r) => String(r.dedupe_key)).filter(Boolean))];
  }
  return [...new Set((data ?? []).map((r) => String(r.dedupe_key)).filter(Boolean))];
}
