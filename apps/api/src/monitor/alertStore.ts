import type { AlertEventStore, MonitorAlertEvent } from "@wulu/scanner";
import { MemoryAlertEventStore } from "@wulu/scanner";
import { insertMonitorAlertEvent, listMonitorAlertEvents } from "./persistence.js";

/** Memory + optional Supabase dual-write for Phase 2 alert prep. */
export class HybridAlertEventStore implements AlertEventStore {
  private readonly memory = new MemoryAlertEventStore();

  async record(event: MonitorAlertEvent): Promise<boolean> {
    const ok = await this.memory.record(event);
    if (!ok) return false;
    await insertMonitorAlertEvent(event);
    return true;
  }

  async list(userId: string, limit = 50): Promise<MonitorAlertEvent[]> {
    const fromDb = await listMonitorAlertEvents(userId, limit);
    if (fromDb.length > 0) return fromDb;
    return this.memory.list(userId, limit);
  }
}
