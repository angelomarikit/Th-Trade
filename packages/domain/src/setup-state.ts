/**
 * Canonical setup lifecycle. A trigger is NOT an entry.
 * ENTRY ACTIVE requires completed 5m confirmation + volume + structure + zone + R:R.
 */
export const SETUP_STATES = [
  "WAIT",
  "NEAR_ACTIVE",
  "ENTRY_ACTIVE_LONG",
  "ENTRY_ACTIVE_SHORT",
  "MISSED",
  "INVALIDATED",
  "NO_TRADE",
  "DATA_NOT_VERIFIED",
] as const;

export type SetupState = (typeof SETUP_STATES)[number];

export function isEntryActive(state: SetupState): boolean {
  return state === "ENTRY_ACTIVE_LONG" || state === "ENTRY_ACTIVE_SHORT";
}

export function isTerminal(state: SetupState): boolean {
  return (
    state === "MISSED" ||
    state === "INVALIDATED" ||
    state === "NO_TRADE" ||
    state === "DATA_NOT_VERIFIED"
  );
}

/** States that must never submit or imply an executable entry without confirmation. */
export const NON_ENTRY_STATES: readonly SetupState[] = [
  "WAIT",
  "NEAR_ACTIVE",
  "MISSED",
  "INVALIDATED",
  "NO_TRADE",
  "DATA_NOT_VERIFIED",
];
