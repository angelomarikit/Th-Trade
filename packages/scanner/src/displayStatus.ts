/**
 * Map internal setup states / labels to Phase 2 user-facing statuses.
 * Does not alter the confirmation state machine.
 */
export function toUserFacingStatus(input: {
  state: string;
  statusLabel: string;
  fiveMinStatus: string | null;
  nearActive: boolean;
  dataFresh: boolean;
}): string {
  if (!input.dataFresh) return "DATA NOT VERIFIED";
  const state = (input.state ?? "").toUpperCase();
  const label = (input.statusLabel ?? "").toUpperCase();

  if (state.includes("DATA_NOT_VERIFIED") || label.includes("DATA NOT VERIFIED")) {
    return "DATA NOT VERIFIED";
  }
  if (state.includes("ENTRY_ACTIVE") || label.includes("ENTRY ACTIVE")) {
    return "ENTRY ACTIVE";
  }
  if (state.includes("MISSED") || label.includes("MISSED")) return "MISSED";
  if (state.includes("INVALIDATED") || label.includes("INVALIDATED")) return "INVALIDATED";
  if (state.includes("NO_TRADE") || label.includes("NO TRADE")) return "NO TRADE";

  // Approaching trigger while 5m confirmation is still evaluating → CONFIRMATION
  const five = (input.fiveMinStatus ?? "").toUpperCase();
  if (
    (state.includes("NEAR_ACTIVE") || input.nearActive || label.includes("NEAR ACTIVE")) &&
    (five === "WAITING" || five === "PENDING")
  ) {
    return "CONFIRMATION";
  }
  if (state.includes("NEAR_ACTIVE") || input.nearActive || label.includes("NEAR ACTIVE")) {
    return "NEAR ACTIVE";
  }
  return "WAIT";
}
