/** Same filter as monitor event recording — for in-app notification pulls. */
export function isUserVisibleMonitorTransition(prev: string, next: string): boolean {
  if (!next || prev === next) return false;
  const p = shortStatus(prev);
  const n = shortStatus(next);
  if (p === n) return false;
  if (n === "ENTRY ACTIVE") return true;
  if (n === "NEAR ACTIVE" && (p === "WAIT" || p === "CONFIRMATION")) return true;
  if (n === "MISSED" || n === "INVALIDATED") return true;
  if (n.includes("TARGET HIT") || n.includes("STOP HIT")) return true;
  return false;
}

/** Customer-facing labels for monitor lifecycle events. */
export function formatMonitorEventChange(previousStatus: string, newStatus: string): string {
  const prev = shortStatus(previousStatus);
  const next = shortStatus(newStatus);
  if (prev === next) return next;
  return `${prev} → ${next}`;
}

export function formatMonitorEventReason(
  previousStatus: string,
  newStatus: string,
  reason: string,
): string {
  const trimmed = reason.trim();
  if (trimmed && !/^status\s+/i.test(trimmed)) return trimmed;
  const next = shortStatus(newStatus);
  if (next.includes("INVALIDATED")) {
    return trimmed.replace(/^status\s+/i, "") || "Setup no longer valid — see card for details.";
  }
  if (next.includes("MISSED")) return "Price left the entry zone — do not chase.";
  if (next.includes("ENTRY ACTIVE")) return "Confirmation passed on completed bars.";
  if (trimmed) return trimmed.replace(/^Status\s+/i, "");
  return `Setup updated to ${next}.`;
}

function shortStatus(status: string): string {
  const u = status.toUpperCase();
  if (u.includes("ENTRY ACTIVE")) return "ENTRY ACTIVE";
  if (u.includes("NEAR ACTIVE")) return "NEAR ACTIVE";
  if (u.includes("CONFIRMATION")) return "CONFIRMATION";
  if (u.includes("INVALIDATED")) return "INVALIDATED";
  if (u.includes("MISSED")) return "MISSED";
  if (u.includes("NO TRADE")) return "NO TRADE";
  if (u.includes("DATA NOT VERIFIED")) return "DATA NOT VERIFIED";
  if (u.includes("SCANNING")) return "SCANNING";
  if (u.includes("TARGET HIT")) return "TARGET HIT";
  if (u.includes("STOP HIT")) return "STOP HIT";
  if (u.includes("WAIT")) return "WAIT";
  return status || "—";
}

/** Merge API snapshot into stable watchlist order (configs first). */
export function orderedMonitorStates(
  snap: {
    symbols: Array<{ symbol: string; side: "LONG" | "SHORT" }>;
    states: Array<{ symbol: string }>;
  } | null,
): string[] {
  if (!snap) return [];
  if (snap.symbols.length > 0) return snap.symbols.map((s) => s.symbol);
  return snap.states.map((s) => s.symbol);
}
