import type { MarketSnapshot } from "@wulu/market-data";
import { resolveHtfFromSnapshot, type HtfBias } from "./bars.js";

export function htfForConfirmations(snapshot: Pick<MarketSnapshot, "bars5m" | "bars15m" | "bars1h">): {
  htf1h: HtfBias;
  htf15m: HtfBias;
  native1h: boolean;
  native15m: boolean;
  primary: HtfBias;
  trendContextSuffix: string;
} {
  const r = resolveHtfFromSnapshot(snapshot);
  const suffix = `1h ${r.htf1h}${r.native1h ? "" : " (proxy)"} · 15m ${r.htf15m}${r.native15m ? "" : " (proxy)"}`;
  return {
    htf1h: r.htf1h,
    htf15m: r.htf15m,
    native1h: r.native1h,
    native15m: r.native15m,
    primary: r.primary,
    trendContextSuffix: suffix,
  };
}
