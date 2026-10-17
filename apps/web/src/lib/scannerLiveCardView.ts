import type { SetupResponse } from "./api";

/** Fields dropped from inferred `SetupResponse["liveCard"]` due to TS circularity on `card`. */
type LiveCardQuoteAndGeometry = {
  entryGeometry?: {
    kind: string;
    summary: string;
    entryModelNote: string;
  };
  quoteTransparency?: {
    bid: number | null;
    ask: number | null;
    spreadPct: number | null;
    quoteAt: string | null;
    priceSource?: string;
    referencePriceOnly?: boolean;
    priceBasis: string;
  };
};

export type ScannerLiveCardView = SetupResponse["liveCard"] & LiveCardQuoteAndGeometry;

export function viewLiveCard(
  liveCard: SetupResponse["liveCard"],
): ScannerLiveCardView {
  return liveCard as ScannerLiveCardView;
}
