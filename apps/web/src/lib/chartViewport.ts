import type { Logical } from "lightweight-charts";

/** Small padding after the last candle — not a large empty future gap. */
export const RIGHT_OFFSET_BARS = 3;
export const DEFAULT_VISIBLE_BARS = 72;
export const MIN_VISIBLE_BARS = 8;
export const DEFAULT_BAR_SPACING = 7;

/** Default visible range when following live (matches Return to Live). */
export function liveVisibleLogicalRange(barCount: number): { from: number; to: number } | null {
  if (barCount <= 0) return null;
  const maxTo = barCount - 1 + RIGHT_OFFSET_BARS;
  const visible = Math.min(DEFAULT_VISIBLE_BARS, barCount);
  const from = Math.max(0, barCount - visible);
  const to = maxTo;
  return clampVisibleLogicalRange(from, to, barCount);
}

/** lightweight-charts throws if from > to — common on mobile pinch before data settles. */
export function clampVisibleLogicalRange(
  from: number,
  to: number,
  barCount: number,
): { from: Logical; to: Logical } | null {
  if (barCount <= 0) return null;
  const maxTo = barCount - 1 + RIGHT_OFFSET_BARS;
  let f = Number.isFinite(from) ? from : 0;
  let t = Number.isFinite(to) ? to : maxTo;
  f = Math.max(0, Math.min(f, maxTo));
  t = Math.max(0, Math.min(t, maxTo));
  if (f > t) {
    const visible = Math.min(DEFAULT_VISIBLE_BARS, barCount);
    f = Math.max(0, barCount - visible);
    t = maxTo;
  }
  if (t - f < MIN_VISIBLE_BARS) {
    t = Math.min(maxTo, f + MIN_VISIBLE_BARS);
    f = Math.max(0, t - MIN_VISIBLE_BARS);
  }
  if (f > t) return null;
  return { from: f as Logical, to: t as Logical };
}
