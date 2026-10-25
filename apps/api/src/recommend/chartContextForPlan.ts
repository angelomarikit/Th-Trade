export interface PlanChartBar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  vwap?: number | null;
}

export function buildChartContextForPlan(input: {
  symbol: string;
  timeframe: string;
  bars: PlanChartBar[];
  levels: {
    alertAt: number;
    entryLow: number;
    entryHigh: number;
    stop: number;
    t1: number;
  };
  lastPrice: number;
}): Record<string, unknown> {
  const bars = input.bars.filter((b) => Number.isFinite(b.close)).slice(-20);
  if (bars.length === 0) {
    return {
      timeframe: input.timeframe,
      barCount: 0,
      note: "No chart bars supplied — use price levels only.",
    };
  }
  const first = bars[0]!;
  const last = bars.at(-1)!;
  let hi = -Infinity;
  let lo = Infinity;
  let vol = 0;
  for (const b of bars) {
    hi = Math.max(hi, b.high);
    lo = Math.min(lo, b.low);
    vol += b.volume ?? 0;
  }
  const changePct = first.open > 0 ? ((last.close - first.open) / first.open) * 100 : null;
  const lastVwap = last.vwap ?? bars.filter((b) => b.vwap != null).at(-1)?.vwap ?? null;
  const vwapSide =
    lastVwap != null
      ? last.close > lastVwap * 1.001
        ? "ABOVE_VWAP"
        : last.close < lastVwap * 0.999
          ? "BELOW_VWAP"
          : "AT_VWAP"
      : "UNKNOWN";
  const { alertAt, entryLow, entryHigh, stop, t1 } = input.levels;
  const px = input.lastPrice;
  const inZone = px >= entryLow && px <= entryHigh;
  const distTriggerPct =
    alertAt > 0 ? ((px - alertAt) / alertAt) * 100 : null;

  const recent = bars.slice(-6);
  let trend: "UP" | "DOWN" | "RANGE" = "RANGE";
  if (recent.length >= 3) {
    const up = recent.filter((b, i) => i > 0 && b.close > recent[i - 1]!.close).length;
    if (up >= 4) trend = "UP";
    else if (up <= 1) trend = "DOWN";
  }

  return {
    timeframe: input.timeframe,
    barCount: bars.length,
    windowHigh: hi,
    windowLow: lo,
    windowVolume: vol,
    sessionChangePct: changePct,
    lastBar: {
      time: last.time,
      open: last.open,
      high: last.high,
      low: last.low,
      close: last.close,
      volume: last.volume,
      vwap: last.vwap ?? null,
    },
    recentBars: bars.slice(-8).map((b) => ({
      t: b.time,
      o: b.open,
      h: b.high,
      l: b.low,
      c: b.close,
      v: b.volume,
    })),
    structure: {
      intradayTrend: trend,
      vwapSide,
      lastVwap,
      priceVsEntryZone: inZone ? "INSIDE_ZONE" : px < entryLow ? "BELOW_ZONE" : "ABOVE_ZONE",
      distanceToTriggerPct: distTriggerPct,
      trigger: alertAt,
      entryZone: [entryLow, entryHigh],
      stop,
      t1,
    },
  };
}
