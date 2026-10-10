import { randomUUID } from "node:crypto";

export interface MonitorAlertEvent {
  id: string;
  userId: string;
  symbol: string;
  side: string;
  previousStatus: string;
  newStatus: string;
  setupId: string;
  eventAt: string;
  marketDataAt: string | null;
  trigger: number | null;
  entryZone: { low: number; high: number; executable: boolean } | null;
  stop: number | null;
  target1: number | null;
  target2: number | null;
  dataFresh: boolean;
  reason: string;
  confirmationDetails: string[];
  dedupeKey: string;
}

export interface AlertEventStore {
  record(event: MonitorAlertEvent): Promise<boolean>;
  list(userId: string, limit?: number): Promise<MonitorAlertEvent[]>;
}

/** In-memory store with dedupe — used when Supabase table is unavailable. */
export class MemoryAlertEventStore implements AlertEventStore {
  private readonly byUser = new Map<string, MonitorAlertEvent[]>();
  private readonly seen = new Set<string>();

  async record(event: MonitorAlertEvent): Promise<boolean> {
    if (this.seen.has(event.dedupeKey)) return false;
    this.seen.add(event.dedupeKey);
    const list = this.byUser.get(event.userId) ?? [];
    list.unshift(event);
    this.byUser.set(event.userId, list.slice(0, 500));
    return true;
  }

  async list(userId: string, limit = 50): Promise<MonitorAlertEvent[]> {
    return (this.byUser.get(userId) ?? []).slice(0, limit);
  }
}

export function buildAlertEvent(input: {
  userId: string;
  symbol: string;
  side: string;
  previousStatus: string;
  newStatus: string;
  marketDataAt: string | null;
  trigger: number | null;
  entryZone: { low: number; high: number; executable: boolean } | null;
  stop: number | null;
  target1: number | null;
  target2: number | null;
  dataFresh: boolean;
  reason: string;
  confirmationDetails: string[];
}): MonitorAlertEvent {
  const eventAt = new Date().toISOString();
  const setupId = `${input.symbol}:${input.side}:${input.newStatus}`;
  // Bucket to minute so poll loops don't spam identical transitions
  const bucket = eventAt.slice(0, 16);
  const dedupeKey = `${input.userId}|${input.symbol}|${input.previousStatus}|${input.newStatus}|${bucket}`;
  return {
    id: randomUUID(),
    userId: input.userId,
    symbol: input.symbol,
    side: input.side,
    previousStatus: input.previousStatus,
    newStatus: input.newStatus,
    setupId,
    eventAt,
    marketDataAt: input.marketDataAt,
    trigger: input.trigger,
    entryZone: input.entryZone,
    stop: input.stop,
    target1: input.target1,
    target2: input.target2,
    dataFresh: input.dataFresh,
    reason: input.reason,
    confirmationDetails: input.confirmationDetails,
    dedupeKey,
  };
}

/** Meaningful status-family transitions for Phase 2 alert prep (no SMS/push yet). */
export function isAlertWorthyTransition(prev: string, next: string): boolean {
  if (!next || prev === next) return false;
  const p = normalizeStatusFamily(prev);
  const n = normalizeStatusFamily(next);
  if (p === n) return false;
  if (n === "DATA NOT VERIFIED") return true;
  if (n === "NEAR ACTIVE" || n === "CONFIRMATION" || n === "ENTRY ACTIVE") return true;
  if (n === "MISSED" || n === "INVALIDATED") return true;
  if (p === "WAIT" && n !== "WAIT") return true;
  return false;
}

export function normalizeStatusFamily(status: string): string {
  const u = status.toUpperCase();
  if (u.includes("DATA NOT VERIFIED") || u.includes("DATA_NOT_VERIFIED")) return "DATA NOT VERIFIED";
  if (u.includes("ENTRY ACTIVE") || u.includes("ENTRY_ACTIVE")) return "ENTRY ACTIVE";
  if (u.includes("CONFIRMATION")) return "CONFIRMATION";
  if (u.includes("NEAR ACTIVE") || u.includes("NEAR_ACTIVE")) return "NEAR ACTIVE";
  if (u.includes("MISSED")) return "MISSED";
  if (u.includes("INVALIDATED")) return "INVALIDATED";
  if (u.includes("NO TRADE") || u.includes("NO_TRADE")) return "NO TRADE";
  if (u.includes("WAIT")) return "WAIT";
  return u || "WAIT";
}
