import type { SetupResponse } from "./api";

export function setupCardSide(
  data: SetupResponse | null | undefined,
): "LONG" | "SHORT" | null {
  const raw = data?.liveCard?.side ?? data?.card?.side;
  if (raw === "LONG" || raw === "SHORT") return raw;
  const u = typeof raw === "string" ? raw.toUpperCase() : "";
  if (u === "LONG" || u === "SHORT") return u;
  return null;
}

/** True when the loaded setup card matches the direction toggle (avoids LONG ENTER on SHORT). */
export function setupMatchesSelectedSide(
  data: SetupResponse | null | undefined,
  selected: "LONG" | "SHORT",
): boolean {
  const cardSide = setupCardSide(data);
  if (!cardSide) return true;
  return cardSide === selected;
}
