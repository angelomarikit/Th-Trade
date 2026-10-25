import type { SetupLiveCard } from "./api";

export type UiTradingAction = "WAIT" | "ENTER" | "SKIP" | "INVALIDATED";

/** Single UI rule: never show ENTER for the wrong side or blocked mock lab side. */
export function effectiveTradingAction(
  liveCard: SetupLiveCard | null | undefined,
  selectedSide: "LONG" | "SHORT",
): UiTradingAction {
  if (!liveCard) return "WAIT";
  const cardSide = liveCard.side;
  if (cardSide && cardSide !== selectedSide) return "WAIT";
  const authorized = liveCard.labMockEnterAuthorizedSide;
  if (authorized && authorized !== selectedSide) return "WAIT";
  if (authorized && !liveCard.mockEnter) return "WAIT";
  const raw = liveCard.tradingAction ?? "WAIT";
  if (raw === "ENTER" && liveCard.dataFresh === false) return "WAIT";
  return raw;
}
