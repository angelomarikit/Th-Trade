import type { PlanTier } from "../billing/plans.js";
import { getPlan } from "../billing/plans.js";

/** Preview-only: ignore billing caps so acceptance testing is not blocked (production unchanged). */
export function isPreviewDevWatchlist(): boolean {
  return process.env.WULU_PREVIEW_DEV_WATCHLIST === "1";
}

/** Effective watchlist cap for monitor mutations (preview can raise floor via env). */
export function resolveWatchlistPlanMax(planTier?: PlanTier | null): number {
  const hubMax = Number(process.env.MONITOR_MAX_SYMBOLS ?? 12);
  if (isPreviewDevWatchlist()) {
    const previewMax = Number(process.env.WULU_PREVIEW_WATCHLIST_MAX ?? hubMax);
    const n = Number.isFinite(previewMax) && previewMax > 0 ? Math.floor(previewMax) : hubMax;
    return Math.min(hubMax, n);
  }

  let cap = hubMax;
  if (planTier) {
    cap = Math.min(getPlan(planTier).maxWatchlist, cap);
  }
  const floor = Number(process.env.WULU_ACCEPTANCE_MIN_WATCHLIST ?? 0);
  if (Number.isFinite(floor) && floor > 0) {
    cap = Math.max(cap, Math.floor(floor));
  }
  return cap;
}
