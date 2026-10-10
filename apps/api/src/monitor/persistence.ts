import type { MonitorAlertEvent, MonitorSymbolConfig } from "@wulu/scanner";
import { getSupabaseAdmin, isSupabaseConfigured } from "../billing/supabaseAdmin.js";

export interface StoredWatchlistRow {
  userId: string;
  symbols: MonitorSymbolConfig[];
}

export async function saveMonitorWatchlist(
  userId: string,
  symbols: MonitorSymbolConfig[],
): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const sb = getSupabaseAdmin();
  const { error } = await sb.from("monitor_watchlists").upsert(
    {
      user_id: userId,
      symbols,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) {
    // Table may not exist until migration is applied — non-fatal for Phase 2 local/dev.
    throw new Error(error.message);
  }
}

export async function loadMonitorWatchlist(
  userId: string,
): Promise<MonitorSymbolConfig[] | null> {
  if (!isSupabaseConfigured()) return null;
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("monitor_watchlists")
    .select("symbols")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.symbols) return null;
  return normalizeStoredSymbols(data.symbols);
}

export async function loadAllMonitorWatchlists(): Promise<StoredWatchlistRow[]> {
  if (!isSupabaseConfigured()) return [];
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.from("monitor_watchlists").select("user_id, symbols");
  if (error) {
    console.warn("[monitor] loadAllWatchlists:", error.message);
    return [];
  }
  return (data ?? [])
    .map((row) => ({
      userId: row.user_id as string,
      symbols: normalizeStoredSymbols(row.symbols),
    }))
    .filter((r) => r.userId && r.symbols.length > 0);
}

export async function insertMonitorAlertEvent(event: MonitorAlertEvent): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  const sb = getSupabaseAdmin();
  const { error } = await sb.from("monitor_alert_events").insert({
    id: event.id,
    user_id: event.userId,
    symbol: event.symbol,
    side: event.side,
    previous_status: event.previousStatus,
    new_status: event.newStatus,
    setup_id: event.setupId,
    event_at: event.eventAt,
    market_data_at: event.marketDataAt,
    trigger_level: event.trigger,
    entry_zone: event.entryZone,
    stop_level: event.stop,
    target1: event.target1,
    target2: event.target2,
    data_fresh: event.dataFresh,
    reason: event.reason,
    confirmation_details: event.confirmationDetails,
    dedupe_key: event.dedupeKey,
  });
  if (error) {
    if (error.message.toLowerCase().includes("duplicate") || error.code === "23505") {
      return false;
    }
    console.warn("[monitor] alert insert:", error.message);
    return false;
  }
  return true;
}

export async function listMonitorAlertEvents(
  userId: string,
  limit = 50,
): Promise<MonitorAlertEvent[]> {
  if (!isSupabaseConfigured()) return [];
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("monitor_alert_events")
    .select("*")
    .eq("user_id", userId)
    .order("event_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.warn("[monitor] alert list:", error.message);
    return [];
  }
  return (data ?? []).map((row) => ({
    id: row.id,
    userId: row.user_id,
    symbol: row.symbol,
    side: row.side,
    previousStatus: row.previous_status,
    newStatus: row.new_status,
    setupId: row.setup_id,
    eventAt: row.event_at,
    marketDataAt: row.market_data_at,
    trigger: row.trigger_level,
    entryZone: row.entry_zone,
    stop: row.stop_level,
    target1: row.target1,
    target2: row.target2,
    dataFresh: row.data_fresh,
    reason: row.reason,
    confirmationDetails: row.confirmation_details ?? [],
    dedupeKey: row.dedupe_key,
  }));
}

function normalizeStoredSymbols(raw: unknown): MonitorSymbolConfig[] {
  if (!Array.isArray(raw)) return [];
  const out: MonitorSymbolConfig[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const symbol = String((item as { symbol?: string }).symbol ?? "")
      .trim()
      .toUpperCase();
    if (!symbol || seen.has(symbol)) continue;
    const side = (item as { side?: string }).side === "SHORT" ? "SHORT" : "LONG";
    seen.add(symbol);
    out.push({ symbol, side });
  }
  return out;
}
