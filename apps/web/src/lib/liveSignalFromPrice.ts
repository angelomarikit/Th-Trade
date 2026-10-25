import type { SetupLiveCard } from "./api";
import type { UiTradingAction } from "./effectiveTradingAction";

function distanceLabel(trigger: number, lastPrice: number): { pct: number; label: string } {
  const distanceAbs = lastPrice - trigger;
  const distancePct = trigger !== 0 ? (distanceAbs / trigger) * 100 : 0;
  const label =
    Math.abs(distancePct) < 0.05
      ? "AT TRIGGER"
      : distanceAbs > 0
        ? `${distancePct.toFixed(2)}% ABOVE TRIGGER`
        : `${Math.abs(distancePct).toFixed(2)}% BELOW TRIGGER`;
  return { pct: distancePct, label };
}

/** Keep WAIT/ENTER from engine; refresh distance + last price from the chart every tick. */
export function enrichLiveCardWithChartPrice(
  lc: SetupLiveCard,
  chartPrice: number | null | undefined,
): SetupLiveCard {
  if (chartPrice == null || !Number.isFinite(chartPrice) || chartPrice <= 0) return lc;
  const trigger = lc.alertAt;
  if (!Number.isFinite(trigger) || trigger <= 0) return { ...lc, lastPrice: chartPrice };

  const { pct, label } = distanceLabel(trigger, chartPrice);
  const near = lc.nearActive
    ? {
        ...lc.nearActive,
        distanceToTriggerAbs: chartPrice - trigger,
        distanceToTriggerPct: pct,
        distanceLabel: label,
      }
    : lc.nearActive;

  return {
    ...lc,
    lastPrice: chartPrice,
    nearActive: near,
  };
}

/** Headline strip: engine action + live distance (signals move with the chart). */
export function liveSignalHeadline(input: {
  status: string;
  tradingAction: UiTradingAction;
  distanceLabel: string | null | undefined;
  side: "LONG" | "SHORT";
}): string {
  const base = input.tradingAction;
  const dist = input.distanceLabel?.trim();
  if (base === "ENTER") return `ENTER · ${input.side}`;
  if (base === "SKIP") return `SKIP · ${input.side}`;
  if (base === "INVALIDATED") return `INVALIDATED · ${input.side}`;
  if (dist === "AT TRIGGER") return `AT TRIGGER · WAIT · ${input.side}`;
  if (dist) return `WAIT · ${dist} · ${input.side}`;
  return `WAIT · ${input.side}`;
}
