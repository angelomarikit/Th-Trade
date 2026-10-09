import type { SetupState } from "@wulu/domain";
import { isEntryActive } from "@wulu/domain";
import type { CatalystEvent } from "./types.js";

/**
 * Hard safety: news/catalyst scores must never alone produce ENTRY ACTIVE.
 * Phase B will own the full confirmation path; this guard stays permanent.
 */
export function newsAloneCannotActivateEntry(
  currentState: SetupState,
  _event: CatalystEvent | null,
): SetupState {
  if (isEntryActive(currentState)) {
    // Entry active must have been granted by confirmation engine, not news.
    return currentState;
  }
  // Explicitly refuse any transition to entry from news layer.
  return currentState === "NEAR_ACTIVE" ? "NEAR_ACTIVE" : currentState;
}

export function assertNewsDoesNotGrantEntry(proposed: SetupState): void {
  if (isEntryActive(proposed)) {
    throw new Error(
      "SAFETY: News/catalyst layer attempted to set ENTRY ACTIVE. Forbidden.",
    );
  }
}
