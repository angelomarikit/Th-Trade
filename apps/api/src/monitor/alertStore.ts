import type { AlertEventStore, MonitorAlertEvent } from "@wulu/scanner";
import { MemoryAlertEventStore } from "@wulu/scanner";
import { insertMonitorAlertEvent, listMonitorAlertEvents } from "./persistence.js";
import {
  loadRecentAlertDedupeKeys,
  recordAlertDedupeKey,
} from "./openTracks.js";
import { planAlertDelivery } from "./signalHistory.js";

/** Memory + optional Supabase dual-write for alert prep + delivery planning. */
export class HybridAlertEventStore implements AlertEventStore {
  private readonly memory = new MemoryAlertEventStore();
  private seeded = false;

  /** Load durable dedupe keys so restart cannot re-fire the same alert spam. */
  async seedFromDatabase(): Promise<number> {
    const keys = await loadRecentAlertDedupeKeys();
    this.memory.seedDedupeKeys(keys);
    this.seeded = true;
    return keys.length;
  }

  async record(event: MonitorAlertEvent): Promise<boolean> {
    if (!this.seeded) {
      await this.seedFromDatabase().catch(() => undefined);
    }
    const ok = await this.memory.record(event);
    if (!ok) return false;

    // Durable dedupe table first — if key already exists, skip insert/delivery.
    const dedupeOk = await recordAlertDedupeKey(event.dedupeKey, event.userId, event.id);
    if (!dedupeOk) return false;

    const inserted = await insertMonitorAlertEvent(event);
    if (!inserted) {
      // Unique constraint on monitor_alert_events.dedupe_key — already recorded.
      return false;
    }

    // Plan channels only — never places orders; SMS/email/push senders not wired.
    void planAlertDelivery(event.userId, event.id);
    return true;
  }

  async list(userId: string, limit = 50): Promise<MonitorAlertEvent[]> {
    const fromDb = await listMonitorAlertEvents(userId, limit);
    if (fromDb.length > 0) return fromDb;
    return this.memory.list(userId, limit);
  }
}
