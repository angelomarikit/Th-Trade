import type { OpenTrackedSignal } from "@wulu/confirmation";
import { getSupabaseAdmin, isSupabaseConfigured } from "../billing/supabaseAdmin.js";

function isUuid(v: string | null | undefined): boolean {
  if (!v) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

/** Dual-write: dedicated open_signal_tracks table when present, always mirror into performance rows. */
export async function upsertOpenTrack(track: OpenTrackedSignal): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  const sb = getSupabaseAdmin();
  let ok = false;

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
    console.warn("[open-tracks] table upsert:", error.message);
  } else {
    ok = true;
  }

  // Always mirror into signal_performance_records so restarts can hydrate even if
  // open_signal_tracks migration is not applied yet.
  const mirror = await sb.from("signal_performance_records").upsert(
    {
      id: track.id,
      user_id: isUuid(track.userId) ? track.userId : null,
      symbol: track.symbol,
      side: track.side,
      strategy_type: track.strategyType,
      setup_id: track.setupId,
      signal_timestamp: track.entryAt,
      trigger_level: track.entryPrice,
      entry_zone: {
        low: track.entryPrice,
        high: track.entryPrice,
        executable: true,
      },
      stop_level: track.stop,
      target1: track.target1,
      target2: track.target2,
      target3: track.target3,
      quality_score_10: track.qualityScore10,
      setup_score_100: 0,
      state: "ENTRY_ACTIVE_OPEN",
      actionable: true,
      data_quality_ok: true,
      confirmation_summary: [
        "outcomeDetail:OPEN",
        `entryPrice:${track.entryPrice}`,
        `stop:${track.stop}`,
        `target1:${track.target1}`,
        `target2:${track.target2}`,
        `target3:${track.target3 ?? ""}`,
        `barsElapsed:${track.barsElapsed}`,
        `source:${track.source}`,
        `setupId:${track.setupId}`,
      ],
      outcome_status: "UNKNOWN",
      source: track.source,
      live_validated: false,
    },
    { onConflict: "id" },
  );
  if (mirror.error) {
    console.warn("[open-tracks] performance mirror:", mirror.error.message);
  } else {
    ok = true;
  }
  return ok;
}

export async function closeOpenTrack(id: string): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const sb = getSupabaseAdmin();
  const { error } = await sb
    .from("open_signal_tracks")
    .update({ status: "RESOLVED", updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) console.warn("[open-tracks] close:", error.message);

  // Flip mirror row so hydrate does not re-open resolved tracks.
  const { data } = await sb
    .from("signal_performance_records")
    .select("confirmation_summary")
    .eq("id", id)
    .maybeSingle();
  const summary = Array.isArray(data?.confirmation_summary)
    ? (data!.confirmation_summary as string[]).filter((s) => !s.startsWith("outcomeDetail:OPEN"))
    : [];
  summary.unshift("outcomeDetail:RESOLVED_CLOSED");
  await sb
    .from("signal_performance_records")
    .update({
      confirmation_summary: summary,
      state: "RESOLVED",
    })
    .eq("id", id);
}

export async function loadOpenTracks(): Promise<OpenTrackedSignal[]> {
  if (!isSupabaseConfigured()) return [];
  const sb = getSupabaseAdmin();
  const byId = new Map<string, OpenTrackedSignal>();

  const { data, error } = await sb
    .from("open_signal_tracks")
    .select("*")
    .eq("status", "OPEN")
    .order("updated_at", { ascending: false })
    .limit(500);
  if (error) {
    console.warn("[open-tracks] load table:", error.message);
  } else {
    for (const row of data ?? []) {
      const t = rowToTrack(row);
      byId.set(t.id, t);
    }
  }

  // Fallback / merge: OPEN mirrors in signal_performance_records
  const { data: mirrors, error: mErr } = await sb
    .from("signal_performance_records")
    .select("*")
    .like("id", "track:%")
    .eq("outcome_status", "UNKNOWN")
    .order("signal_timestamp", { ascending: false })
    .limit(500);
  if (mErr) {
    console.warn("[open-tracks] load mirrors:", mErr.message);
  } else {
    for (const row of mirrors ?? []) {
      const summary = Array.isArray(row.confirmation_summary)
        ? (row.confirmation_summary as string[])
        : [];
      if (!summary.some((s) => s === "outcomeDetail:OPEN")) continue;
      if (summary.some((s) => s.startsWith("outcomeDetail:RESOLVED"))) continue;
      const t = mirrorToTrack(row, summary);
      if (!byId.has(t.id)) byId.set(t.id, t);
    }
  }

  return [...byId.values()];
}

function rowToTrack(row: Record<string, unknown>): OpenTrackedSignal {
  return {
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
  };
}

function tagNum(summary: string[], prefix: string, fallback: number): number {
  const row = summary.find((s) => s.startsWith(prefix));
  if (!row) return fallback;
  const n = Number(row.slice(prefix.length));
  return Number.isFinite(n) ? n : fallback;
}

function tagStr(summary: string[], prefix: string, fallback: string): string {
  const row = summary.find((s) => s.startsWith(prefix));
  return row ? row.slice(prefix.length) : fallback;
}

function mirrorToTrack(row: Record<string, unknown>, summary: string[]): OpenTrackedSignal {
  const entry = tagNum(summary, "entryPrice:", Number(row.trigger_level ?? 0));
  return {
    id: String(row.id),
    userId: (row.user_id as string | null) ?? null,
    symbol: String(row.symbol),
    side: row.side === "SHORT" ? "SHORT" : "LONG",
    setupId: tagStr(summary, "setupId:", String(row.setup_id)),
    entryPrice: entry,
    entryAt: String(row.signal_timestamp),
    stop: tagNum(summary, "stop:", Number(row.stop_level ?? 0)),
    target1: tagNum(summary, "target1:", Number(row.target1 ?? 0)),
    target2: tagNum(summary, "target2:", Number(row.target2 ?? 0)),
    target3: (() => {
      const raw = tagStr(summary, "target3:", "");
      if (!raw) return row.target3 == null ? null : Number(row.target3);
      const n = Number(raw);
      return Number.isFinite(n) ? n : null;
    })(),
    source: tagStr(summary, "source:", "LIVE") === "HISTORICAL_REPLAY" ? "HISTORICAL_REPLAY" : "LIVE",
    barsElapsed: tagNum(summary, "barsElapsed:", 0),
    qualityScore10: row.quality_score_10 == null ? null : Number(row.quality_score_10),
    strategyType: String(row.strategy_type ?? "SCANNER"),
  };
}

export async function recordAlertDedupeKey(
  dedupeKey: string,
  userId: string,
  eventId: string,
): Promise<boolean> {
  if (!isSupabaseConfigured()) return true;
  const sb = getSupabaseAdmin();
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
    // Table may be missing — fall through to monitor_alert_events unique constraint.
    console.warn("[alert-dedupe] insert:", error.message);
    return true;
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
