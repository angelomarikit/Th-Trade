import type { TradeLevels, TradeSide } from "@wulu/domain";
import { isEntryZoneExecutable } from "@wulu/domain";

export type EntryGeometryKind =
  | "IN_ZONE_PULLBACK"
  | "BELOW_ZONE_WAITING"
  | "ABOVE_ZONE_NO_CHASE"
  | "AT_TRIGGER";

export interface EntryGeometry {
  kind: EntryGeometryKind;
  /** Plain language for cards and mobile. */
  summary: string;
  /** Breakout vs pullback vs missed framing. */
  entryModelNote: string;
}

export function describeEntryGeometry(
  side: TradeSide,
  levels: TradeLevels,
  lastPrice: number,
  stateLabel: string,
): EntryGeometry {
  const low = Math.min(levels.entryZoneLow, levels.entryZoneHigh);
  const high = Math.max(levels.entryZoneLow, levels.entryZoneHigh);
  const inZone = isEntryZoneExecutable(levels, lastPrice);
  const above = lastPrice > high * 1.0015;
  const below = lastPrice < low * 0.9985;

  if (stateLabel.includes("MISSED")) {
    return {
      kind: "ABOVE_ZONE_NO_CHASE",
      summary: "Missed — price left the executable entry zone.",
      entryModelNote:
        side === "LONG"
          ? "This was a pullback/breakout setup at the trigger; the move passed without a valid in-zone entry."
          : "Setup missed — do not chase.",
    };
  }

  if (inZone) {
    return {
      kind: "IN_ZONE_PULLBACK",
      summary: "Price is inside the entry zone — evaluate confirmation, not the trigger alone.",
      entryModelNote:
        "Pullback/in-zone entry model. Trigger marks structure; your fill must be inside the zone with ≥2R to T1 at the conservative entry.",
    };
  }

  if (side === "LONG" && above) {
    return {
      kind: "ABOVE_ZONE_NO_CHASE",
      summary: `Price ${lastPrice.toFixed(2)} is above the entry zone (${low.toFixed(2)}–${high.toFixed(2)}) — not a pullback entry at the trigger.`,
      entryModelNote:
        "Breakout chase / extended price. Wait for a retest into the zone or treat the setup as stale unless structure resets.",
    };
  }

  if (side === "SHORT" && below) {
    return {
      kind: "ABOVE_ZONE_NO_CHASE",
      summary: `Price is below the SHORT entry zone — not a valid retest entry at the trigger.`,
      entryModelNote: "Extended move — do not chase; wait for retest into the zone.",
    };
  }

  if (below || (side === "SHORT" && above)) {
    return {
      kind: "BELOW_ZONE_WAITING",
      summary: "Price has not reached the entry zone yet — waiting for pullback/retest toward the trigger.",
      entryModelNote:
        "Pre-entry: trigger and zone define where we would enter after confirmation; current price is not an automatic entry.",
    };
  }

  return {
    kind: "AT_TRIGGER",
    summary: "Near trigger — confirmation and zone rules still apply.",
    entryModelNote: "Watch completed 5m confirmation; entry is the zone, not the trigger line alone.",
  };
}
