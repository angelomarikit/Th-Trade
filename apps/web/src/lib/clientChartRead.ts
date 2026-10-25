import type { ChartBar } from "./api";
import { fmtPrice } from "./format";

/** Plain chart summary when WULU desk API is not deployed yet. */
export function buildClientChartRead(input: {
  timeframe: string;
  bars: ChartBar[];
  levels: {
    alertAt: number;
    entryLow: number;
    entryHigh: number;
    stop: number;
    t1: number;
  };
  lastPrice: number | null;
}): string {
  const bars = input.bars.filter((b) => Number.isFinite(b.close)).slice(-12);
  if (bars.length === 0) {
    return `No ${input.timeframe} bars on chart — use levels from the scan only.`;
  }
  const last = bars.at(-1)!;
  const first = bars[0]!;
  let hi = -Infinity;
  let lo = Infinity;
  for (const b of bars) {
    hi = Math.max(hi, b.high);
    lo = Math.min(lo, b.low);
  }
  const px = input.lastPrice ?? last.close;
  const { entryLow, entryHigh, alertAt, stop, t1 } = input.levels;
  const inZone = px >= entryLow && px <= entryHigh;
  const zoneLabel = inZone ? "inside entry zone" : px < entryLow ? "below entry zone" : "above entry zone";
  const chg =
    first.open > 0 ? (((last.close - first.open) / first.open) * 100).toFixed(2) : "—";
  const vwap = last.vwap;
  const vwapNote =
    vwap != null && Number.isFinite(vwap)
      ? last.close > vwap
        ? "last close above VWAP"
        : last.close < vwap
          ? "last close below VWAP"
          : "last close at VWAP"
      : "VWAP not on bars";

  return `${input.timeframe} window (${bars.length} bars): ${chg}% from window open · range ${fmtPrice(lo)}–${fmtPrice(hi)} · last ${fmtPrice(last.close)} (${zoneLabel}) · ${vwapNote}. Levels: trigger ${fmtPrice(alertAt)}, zone ${fmtPrice(entryLow)}–${fmtPrice(entryHigh)}, stop ${fmtPrice(stop)}, T1 ${fmtPrice(t1)}.`;
}

export function isWuluPlanRouteMissing(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return (
    msg.includes("not found") ||
    msg.includes("404") ||
    msg.includes("/v1/wulu-plan") ||
    msg.includes("wulu-plan")
  );
}
