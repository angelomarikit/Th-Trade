import type { PlanTier } from "../billing/plans.js";
import { getPlan } from "../billing/plans.js";

/** Effective watchlist cap for monitor mutations (preview can raise floor via env). */
export function resolveWatchlistPlanMax(planTier?: PlanTier | null): number {
  let cap = Number(process.env.MONITOR_MAX_SYMBOLS ?? 12);
  if (planTier) {
    cap = Math.min(getPlan(planTier).maxWatchlist, cap);
  }
  const floor = Number(process.env.WULU_ACCEPTANCE_MIN_WATCHLIST ?? 0);
  if (Number.isFinite(floor) && floor > 0) {
    cap = Math.max(cap, Math.floor(floor));
  }
  return cap;
}
